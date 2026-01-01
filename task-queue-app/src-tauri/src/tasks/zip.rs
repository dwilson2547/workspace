use async_trait::async_trait;
use crossbeam_channel::{bounded, Sender};
use flate2::write::DeflateEncoder;
use flate2::Compression;
use rayon::prelude::*;
use serde_json::Value;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tracing::info;
use zip::write::FileOptions;
use zip::ZipWriter;

use super::{calculate_total_size, send_progress, ProgressSender, TaskError, TaskExecutor, TaskResult};
use crate::db::models::{TaskType, ZipConfig};

pub struct ZipExecutor;

#[async_trait]
impl TaskExecutor for ZipExecutor {
    async fn execute(
        &self,
        task_id: &str,
        queue_id: &str,
        config: &Value,
        progress_tx: ProgressSender,
    ) -> Result<TaskResult, TaskError> {
        let config: ZipConfig = serde_json::from_value(config.clone())
            .map_err(|e| TaskError::InvalidConfig(e.to_string()))?;

        // Validate inputs exist
        for input in &config.inputs {
            if !Path::new(input).exists() {
                return Err(TaskError::SourceNotFound(input.clone()));
            }
        }

        info!("Starting zip: {:?} -> {}", config.inputs, config.output);

        // Calculate total size
        let total_bytes = calculate_total_size(&config.inputs)?;

        send_progress(
            &progress_tx,
            task_id,
            queue_id,
            0,
            Some(total_bytes),
            None,
            Some("Starting zip compression...".to_string()),
        );

        // Run compression in blocking task
        let task_id_owned = task_id.to_string();
        let queue_id_owned = queue_id.to_string();

        let result = tokio::task::spawn_blocking(move || {
            create_zip(
                &config.inputs,
                &config.output,
                &task_id_owned,
                &queue_id_owned,
                total_bytes,
                &progress_tx,
            )
        })
        .await
        .map_err(|e| TaskError::Other(e.to_string()))??;

        Ok(result)
    }

    fn task_type(&self) -> TaskType {
        TaskType::Zip
    }

    fn validate_config(&self, config: &Value) -> Result<(), String> {
        let config: ZipConfig =
            serde_json::from_value(config.clone()).map_err(|e| e.to_string())?;

        if config.inputs.is_empty() {
            return Err("At least one input is required".to_string());
        }

        if config.output.is_empty() {
            return Err("Output path is required".to_string());
        }

        if !config.output.ends_with(".zip") {
            return Err("Output file must have .zip extension".to_string());
        }

        Ok(())
    }
}

/// Represents a file ready to be written to zip
struct CompressedFile {
    zip_path: String,
    compressed_data: Vec<u8>,
    uncompressed_size: u64,
    is_dir: bool,
}

/// Create a zip archive from multiple inputs (parallel version)
fn create_zip(
    inputs: &[String],
    output: &str,
    task_id: &str,
    queue_id: &str,
    total_bytes: u64,
    progress_tx: &ProgressSender,
) -> Result<TaskResult, TaskError> {
    // Create output directory if needed
    let output_path = Path::new(output);
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Step 1: Collect all files to process
    let mut file_entries = Vec::new();
    for input in inputs {
        let input_path = Path::new(input);
        
        if input_path.is_file() {
            let file_name = input_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("file");
            file_entries.push((input_path.to_path_buf(), file_name.to_string(), false));
        } else if input_path.is_dir() {
            let base_name = input_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("folder");

            for entry in walkdir::WalkDir::new(input_path) {
                let entry = entry.map_err(|e| TaskError::Other(e.to_string()))?;
                let path = entry.path();
                
                let relative = path.strip_prefix(input_path).unwrap_or(path);
                let zip_path = if relative.as_os_str().is_empty() {
                    base_name.to_string()
                } else {
                    format!("{}/{}", base_name, relative.display())
                };

                file_entries.push((path.to_path_buf(), zip_path, path.is_dir()));
            }
        }
    }

    info!("Processing {} entries in parallel", file_entries.len());

    // Step 2: Parallel compression
    let bytes_compressed = Arc::new(AtomicU64::new(0));
    let (tx, rx) = bounded::<CompressedFile>(100); // Buffer up to 100 compressed files

    let bytes_compressed_clone = bytes_compressed.clone();
    let total_bytes_clone = total_bytes;
    let task_id_clone = task_id.to_string();
    let queue_id_clone = queue_id.to_string();
    let progress_tx_clone = progress_tx.clone();

    // Spawn compression thread pool
    let compression_handle = std::thread::spawn(move || {
        compress_files_parallel(
            file_entries,
            tx,
            bytes_compressed_clone,
            total_bytes_clone,
            &task_id_clone,
            &queue_id_clone,
            &progress_tx_clone,
        )
    });

    // Step 3: Sequential write to zip
    let file = File::create(output)?;
    let mut zip = ZipWriter::new(file);
    
    // Use Stored method since data is already compressed
    let options: FileOptions = FileOptions::default()
        .compression_method(zip::CompressionMethod::Stored);

    let mut files_written = 0u32;

    // Write compressed files as they become available
    while let Ok(compressed) = rx.recv() {
        if compressed.is_dir {
            let dir_options: FileOptions = FileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);
            zip.add_directory(&compressed.zip_path, dir_options)
                .map_err(|e| TaskError::Other(e.to_string()))?;
        } else {
            zip.start_file(&compressed.zip_path, options.clone())
                .map_err(|e| TaskError::Other(e.to_string()))?;
            zip.write_all(&compressed.compressed_data)
                .map_err(|e| TaskError::Other(e.to_string()))?;
            files_written += 1;
        }
    }

    // Wait for compression to complete
    compression_handle
        .join()
        .map_err(|_| TaskError::Other("Compression thread panicked".to_string()))??;

    zip.finish().map_err(|e| TaskError::Other(e.to_string()))?;

    let final_bytes = bytes_compressed.load(Ordering::Relaxed);

    send_progress(
        progress_tx,
        task_id,
        queue_id,
        final_bytes,
        Some(total_bytes),
        None,
        Some("Zip completed".to_string()),
    );

    info!("Zip completed: {} bytes, {} files", final_bytes, files_written);

    Ok(TaskResult::new(final_bytes, files_written))
}

/// Compress files in parallel using rayon
fn compress_files_parallel(
    file_entries: Vec<(PathBuf, String, bool)>,
    tx: Sender<CompressedFile>,
    bytes_compressed: Arc<AtomicU64>,
    total_bytes: u64,
    task_id: &str,
    queue_id: &str,
    progress_tx: &ProgressSender,
) -> Result<(), TaskError> {
    use rayon::iter::IntoParallelIterator;
    
    let last_progress = Arc::new(AtomicU64::new(0));
    let task_id = task_id.to_string();
    let queue_id = queue_id.to_string();
    let progress_tx = progress_tx.clone();

    let result: Result<(), TaskError> = file_entries
        .into_par_iter()
        .try_for_each(|(path, zip_path, is_dir)| {
            if is_dir {
                // Directories don't need compression
                tx.send(CompressedFile {
                    zip_path,
                    compressed_data: Vec::new(),
                    uncompressed_size: 0,
                    is_dir: true,
                })
                .map_err(|_| TaskError::Other("Channel closed".to_string()))?;
            } else {
                // Read file
                let mut file = File::open(&path)?;
                let metadata = file.metadata()?;
                let file_size = metadata.len();
                
                let mut uncompressed_data = Vec::with_capacity(file_size.min(50 * 1024 * 1024) as usize);
                file.read_to_end(&mut uncompressed_data)?;

                // Compress in parallel using DEFLATE (fast level)
                let mut encoder = DeflateEncoder::new(Vec::new(), Compression::fast());
                encoder.write_all(&uncompressed_data)
                    .map_err(|e| TaskError::Other(e.to_string()))?;
                let compressed_data = encoder.finish()
                    .map_err(|e| TaskError::Other(e.to_string()))?;

                let current = bytes_compressed.fetch_add(file_size, Ordering::Relaxed) + file_size;

                // Send progress updates (throttled)
                let last = last_progress.load(Ordering::Relaxed);
                if current.saturating_sub(last) > total_bytes / 100 {
                    // Update every 1%
                    last_progress.store(current, Ordering::Relaxed);
                    send_progress(
                        &progress_tx,
                        &task_id,
                        &queue_id,
                        current,
                        Some(total_bytes),
                        Some(zip_path.clone()),
                        None,
                    );
                }

                tx.send(CompressedFile {
                    zip_path,
                    compressed_data,
                    uncompressed_size: file_size,
                    is_dir: false,
                })
                .map_err(|_| TaskError::Other("Channel closed".to_string()))?;
            }
            Ok(())
        });

    drop(tx); // Close channel to signal completion
    result
}
