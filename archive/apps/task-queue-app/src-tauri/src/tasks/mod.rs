pub mod copy;
pub mod tar;
pub mod transcode;
pub mod zip;

use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::mpsc;

use crate::db::models::{TaskProgress, TaskType};

/// Errors that can occur during task execution
#[derive(Error, Debug)]
pub enum TaskError {
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Source not found: {0}")]
    SourceNotFound(String),

    #[error("Destination error: {0}")]
    DestinationError(String),

    #[error("Process failed with exit code: {0:?}")]
    ProcessFailed(Option<i32>),

    #[error("Process error: {0}")]
    ProcessError(String),

    #[error("Cancelled")]
    Cancelled,

    #[error("Other error: {0}")]
    Other(String),
}

/// Result of a successful task execution
#[derive(Debug, Clone)]
pub struct TaskResult {
    pub bytes_processed: u64,
    pub files_processed: u32,
    pub message: Option<String>,
}

impl TaskResult {
    pub fn new(bytes_processed: u64, files_processed: u32) -> Self {
        Self {
            bytes_processed,
            files_processed,
            message: None,
        }
    }

    pub fn with_message(mut self, msg: impl Into<String>) -> Self {
        self.message = Some(msg.into());
        self
    }
}

/// Progress sender for task executors
pub type ProgressSender = mpsc::UnboundedSender<TaskProgress>;

/// Trait that all task executors must implement
#[async_trait]
pub trait TaskExecutor: Send + Sync {
    /// Execute the task with the given configuration
    async fn execute(
        &self,
        task_id: &str,
        queue_id: &str,
        config: &Value,
        progress_tx: ProgressSender,
    ) -> Result<TaskResult, TaskError>;

    /// Get the task type this executor handles
    fn task_type(&self) -> TaskType;

    /// Validate the configuration before queuing
    fn validate_config(&self, config: &Value) -> Result<(), String>;
}

/// Registry of task executors
pub struct ExecutorRegistry {
    executors: std::collections::HashMap<TaskType, Arc<dyn TaskExecutor>>,
}

impl ExecutorRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            executors: std::collections::HashMap::new(),
        };

        // Register all executors
        registry.register(Arc::new(copy::CopyExecutor));
        registry.register(Arc::new(zip::ZipExecutor));
        registry.register(Arc::new(tar::TarExecutor));
        registry.register(Arc::new(transcode::TranscodeExecutor));

        registry
    }

    fn register(&mut self, executor: Arc<dyn TaskExecutor>) {
        self.executors.insert(executor.task_type(), executor);
    }

    pub fn get(&self, task_type: &TaskType) -> Option<Arc<dyn TaskExecutor>> {
        self.executors.get(task_type).cloned()
    }

    pub fn validate_config(&self, task_type: &TaskType, config: &Value) -> Result<(), String> {
        match self.executors.get(task_type) {
            Some(executor) => executor.validate_config(config),
            None => Err(format!("Unknown task type: {:?}", task_type)),
        }
    }
}

impl Default for ExecutorRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper to send progress updates
pub fn send_progress(
    tx: &ProgressSender,
    task_id: &str,
    queue_id: &str,
    bytes_processed: u64,
    total_bytes: Option<u64>,
    current_file: Option<String>,
    message: Option<String>,
) {
    let percentage = total_bytes.map(|total| {
        if total > 0 {
            (bytes_processed as f32 / total as f32) * 100.0
        } else {
            0.0
        }
    });

    let progress = TaskProgress {
        task_id: task_id.to_string(),
        queue_id: queue_id.to_string(),
        bytes_processed,
        total_bytes,
        percentage,
        current_file,
        message,
    };

    // Ignore send errors (receiver might have dropped)
    let _ = tx.send(progress);
}

/// Calculate total size of files/directories
pub fn calculate_total_size(paths: &[String]) -> std::io::Result<u64> {
    let mut total = 0u64;

    for path in paths {
        let path = std::path::Path::new(path);
        if path.is_file() {
            total += path.metadata()?.len();
        } else if path.is_dir() {
            for entry in walkdir::WalkDir::new(path) {
                let entry = entry?;
                if entry.file_type().is_file() {
                    total += entry.metadata()?.len();
                }
            }
        }
    }

    Ok(total)
}
