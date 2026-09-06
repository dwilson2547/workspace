use async_trait::async_trait;
use serde_json::Value;
use std::path::Path;
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::info;

use super::{send_progress, calculate_total_size, ProgressSender, TaskError, TaskExecutor, TaskResult};
use crate::db::models::{CopyConfig, TaskType};

const BUFFER_SIZE: usize = 64 * 1024; // 64KB buffer

pub struct CopyExecutor;

#[async_trait]
impl TaskExecutor for CopyExecutor {
    async fn execute(
        &self,
        task_id: &str,
        queue_id: &str,
        config: &Value,
        progress_tx: ProgressSender,
    ) -> Result<TaskResult, TaskError> {
        let config: CopyConfig = serde_json::from_value(config.clone())
            .map_err(|e| TaskError::InvalidConfig(e.to_string()))?;

        let source = Path::new(&config.source);
        let destination = Path::new(&config.destination);

        if !source.exists() {
            return Err(TaskError::SourceNotFound(config.source.clone()));
        }

        info!(
            "Starting copy: {} -> {}",
            config.source, config.destination
        );

        // Calculate total size
        let total_bytes = calculate_total_size(&[config.source.clone()])?;
        let mut bytes_processed = 0u64;
        let mut files_processed = 0u32;

        send_progress(
            &progress_tx,
            task_id,
            queue_id,
            0,
            Some(total_bytes),
            None,
            Some("Starting copy...".to_string()),
        );

        if source.is_file() {
            // Copy single file
            bytes_processed = copy_file_with_progress(
                source,
                destination,
                task_id,
                queue_id,
                total_bytes,
                bytes_processed,
                &progress_tx,
            )
            .await?;
            files_processed = 1;
        } else if source.is_dir() {
            // Copy directory recursively
            (bytes_processed, files_processed) = copy_dir_recursive(
                source,
                destination,
                task_id,
                queue_id,
                total_bytes,
                bytes_processed,
                &progress_tx,
            )
            .await?;
        }

        send_progress(
            &progress_tx,
            task_id,
            queue_id,
            bytes_processed,
            Some(total_bytes),
            None,
            Some("Copy completed".to_string()),
        );

        info!(
            "Copy completed: {} bytes, {} files",
            bytes_processed, files_processed
        );

        Ok(TaskResult::new(bytes_processed, files_processed))
    }

    fn task_type(&self) -> TaskType {
        TaskType::Copy
    }

    fn validate_config(&self, config: &Value) -> Result<(), String> {
        let config: CopyConfig =
            serde_json::from_value(config.clone()).map_err(|e| e.to_string())?;

        if config.source.is_empty() {
            return Err("Source path is required".to_string());
        }

        if config.destination.is_empty() {
            return Err("Destination path is required".to_string());
        }

        Ok(())
    }
}

/// Copy a single file with progress reporting
async fn copy_file_with_progress(
    source: &Path,
    destination: &Path,
    task_id: &str,
    queue_id: &str,
    total_bytes: u64,
    mut bytes_processed: u64,
    progress_tx: &ProgressSender,
) -> Result<u64, TaskError> {
    // Create parent directory if needed
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).await?;
    }

    let mut src_file = fs::File::open(source).await?;
    let mut dst_file = fs::File::create(destination).await?;

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let mut buffer = vec![0u8; BUFFER_SIZE];
    let mut last_progress_update = std::time::Instant::now();

    loop {
        let bytes_read = src_file.read(&mut buffer).await?;
        if bytes_read == 0 {
            break;
        }

        dst_file.write_all(&buffer[..bytes_read]).await?;
        bytes_processed += bytes_read as u64;

        // Throttle progress updates to avoid flooding
        if last_progress_update.elapsed().as_millis() > 100 {
            send_progress(
                progress_tx,
                task_id,
                queue_id,
                bytes_processed,
                Some(total_bytes),
                Some(file_name.clone()),
                None,
            );
            last_progress_update = std::time::Instant::now();
        }
    }

    dst_file.flush().await?;

    // Preserve file permissions on Unix
    #[cfg(unix)]
    {
        if let Ok(metadata) = source.metadata() {
            let permissions = metadata.permissions();
            fs::set_permissions(destination, permissions).await.ok();
        }
    }

    Ok(bytes_processed)
}

/// Recursively copy a directory with progress reporting
async fn copy_dir_recursive(
    source: &Path,
    destination: &Path,
    task_id: &str,
    queue_id: &str,
    total_bytes: u64,
    mut bytes_processed: u64,
    progress_tx: &ProgressSender,
) -> Result<(u64, u32), TaskError> {
    let mut files_processed = 0u32;

    // Create destination directory
    fs::create_dir_all(destination).await?;

    // Use walkdir for recursive traversal (blocking, but run in spawn_blocking)
    let source_owned = source.to_path_buf();
    let entries: Vec<_> = tokio::task::spawn_blocking(move || {
        walkdir::WalkDir::new(&source_owned)
            .into_iter()
            .filter_map(|e| e.ok())
            .map(|e| {
                let path = e.path().to_path_buf();
                let is_dir = e.file_type().is_dir();
                let relative = e
                    .path()
                    .strip_prefix(&source_owned)
                    .unwrap_or(e.path())
                    .to_path_buf();
                (path, relative, is_dir)
            })
            .collect()
    })
    .await
    .map_err(|e| TaskError::Other(e.to_string()))?;

    for (src_path, relative, is_dir) in entries {
        let dst_path = destination.join(&relative);

        if is_dir {
            fs::create_dir_all(&dst_path).await?;
        } else {
            bytes_processed = copy_file_with_progress(
                &src_path,
                &dst_path,
                task_id,
                queue_id,
                total_bytes,
                bytes_processed,
                progress_tx,
            )
            .await?;
            files_processed += 1;
        }
    }

    Ok((bytes_processed, files_processed))
}
