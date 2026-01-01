use async_trait::async_trait;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde_json::Value;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use tar::Builder;
use tracing::info;

use super::{calculate_total_size, send_progress, ProgressSender, TaskError, TaskExecutor, TaskResult};
use crate::db::models::{TarConfig, TaskType};

pub struct TarExecutor;

#[async_trait]
impl TaskExecutor for TarExecutor {
    async fn execute(
        &self,
        task_id: &str,
        queue_id: &str,
        config: &Value,
        progress_tx: ProgressSender,
    ) -> Result<TaskResult, TaskError> {
        let config: TarConfig = serde_json::from_value(config.clone())
            .map_err(|e| TaskError::InvalidConfig(e.to_string()))?;

        // Validate inputs exist
        for input in &config.inputs {
            if !Path::new(input).exists() {
                return Err(TaskError::SourceNotFound(input.clone()));
            }
        }

        info!(
            "Starting tar: {:?} -> {} (gzip: {})",
            config.inputs, config.output, config.gzip
        );

        // Calculate total size
        let total_bytes = calculate_total_size(&config.inputs)?;

        send_progress(
            &progress_tx,
            task_id,
            queue_id,
            0,
            Some(total_bytes),
            None,
            Some(format!(
                "Starting tar {}...",
                if config.gzip { "(gzipped)" } else { "" }
            )),
        );

        // Run compression in blocking task
        let task_id_owned = task_id.to_string();
        let queue_id_owned = queue_id.to_string();

        let result = tokio::task::spawn_blocking(move || {
            create_tar(
                &config.inputs,
                &config.output,
                config.gzip,
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
        TaskType::Tar
    }

    fn validate_config(&self, config: &Value) -> Result<(), String> {
        let config: TarConfig =
            serde_json::from_value(config.clone()).map_err(|e| e.to_string())?;

        if config.inputs.is_empty() {
            return Err("At least one input is required".to_string());
        }

        if config.output.is_empty() {
            return Err("Output path is required".to_string());
        }

        // Check for appropriate extension
        if config.gzip {
            if !config.output.ends_with(".tar.gz") && !config.output.ends_with(".tgz") {
                return Err("Gzipped tar output should have .tar.gz or .tgz extension".to_string());
            }
        } else if !config.output.ends_with(".tar") {
            return Err("Tar output should have .tar extension".to_string());
        }

        Ok(())
    }
}

/// Wrapper to track bytes written
struct ProgressWriter<W: Write> {
    inner: W,
    bytes_written: u64,
    total_bytes: u64,
    task_id: String,
    queue_id: String,
    progress_tx: ProgressSender,
    last_update: std::time::Instant,
    current_file: Option<String>,
}

impl<W: Write> ProgressWriter<W> {
    fn new(
        inner: W,
        total_bytes: u64,
        task_id: String,
        queue_id: String,
        progress_tx: ProgressSender,
    ) -> Self {
        Self {
            inner,
            bytes_written: 0,
            total_bytes,
            task_id,
            queue_id,
            progress_tx,
            last_update: std::time::Instant::now(),
            current_file: None,
        }
    }

    fn set_current_file(&mut self, file: Option<String>) {
        self.current_file = file;
    }

    fn into_inner(self) -> W {
        self.inner
    }
}

impl<W: Write> Write for ProgressWriter<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let bytes = self.inner.write(buf)?;
        self.bytes_written += bytes as u64;

        // Throttle progress updates
        if self.last_update.elapsed().as_millis() > 100 {
            send_progress(
                &self.progress_tx,
                &self.task_id,
                &self.queue_id,
                self.bytes_written,
                Some(self.total_bytes),
                self.current_file.clone(),
                None,
            );
            self.last_update = std::time::Instant::now();
        }

        Ok(bytes)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

/// Create a tar archive from multiple inputs
fn create_tar(
    inputs: &[String],
    output: &str,
    gzip: bool,
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

    let file = File::create(output)?;
    let mut files_processed = 0u32;

    let bytes_processed = if gzip {
        // Create gzipped tar
        let encoder = GzEncoder::new(file, Compression::default());
        let progress_writer = ProgressWriter::new(
            encoder,
            total_bytes,
            task_id.to_string(),
            queue_id.to_string(),
            progress_tx.clone(),
        );

        let mut builder = Builder::new(progress_writer);
        files_processed = add_inputs_to_tar(&mut builder, inputs)?;

        let progress_writer = builder.into_inner().map_err(|e| TaskError::Other(e.to_string()))?;
        let bytes = progress_writer.bytes_written;
        let encoder = progress_writer.into_inner();
        encoder.finish()?;
        bytes
    } else {
        // Create uncompressed tar
        let progress_writer = ProgressWriter::new(
            file,
            total_bytes,
            task_id.to_string(),
            queue_id.to_string(),
            progress_tx.clone(),
        );

        let mut builder = Builder::new(progress_writer);
        files_processed = add_inputs_to_tar(&mut builder, inputs)?;

        let progress_writer = builder.into_inner().map_err(|e| TaskError::Other(e.to_string()))?;
        progress_writer.bytes_written
    };

    send_progress(
        progress_tx,
        task_id,
        queue_id,
        bytes_processed,
        Some(total_bytes),
        None,
        Some("Tar completed".to_string()),
    );

    info!(
        "Tar completed: {} bytes, {} files",
        bytes_processed, files_processed
    );

    Ok(TaskResult::new(bytes_processed, files_processed))
}

/// Add all inputs to the tar builder
fn add_inputs_to_tar<W: Write>(
    builder: &mut Builder<W>,
    inputs: &[String],
) -> Result<u32, TaskError> {
    let mut files_processed = 0u32;

    for input in inputs {
        let input_path = Path::new(input);

        if input_path.is_file() {
            // Add single file
            let file_name = input_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("file");

            let mut file = File::open(input_path)?;
            builder
                .append_file(file_name, &mut file)
                .map_err(|e| TaskError::Other(e.to_string()))?;
            files_processed += 1;
        } else if input_path.is_dir() {
            // Add directory recursively
            let base_name = input_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("folder");

            builder
                .append_dir_all(base_name, input_path)
                .map_err(|e| TaskError::Other(e.to_string()))?;

            // Count files
            for entry in walkdir::WalkDir::new(input_path) {
                if let Ok(entry) = entry {
                    if entry.file_type().is_file() {
                        files_processed += 1;
                    }
                }
            }
        }
    }

    Ok(files_processed)
}
