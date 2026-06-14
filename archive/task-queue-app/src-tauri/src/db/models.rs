use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Status of a task queue
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueStatus {
    Paused,
    Running,
}

impl QueueStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            QueueStatus::Paused => "paused",
            QueueStatus::Running => "running",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "running" => QueueStatus::Running,
            _ => QueueStatus::Paused,
        }
    }
}

/// Status of an individual task
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl TaskStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskStatus::Pending => "pending",
            TaskStatus::Running => "running",
            TaskStatus::Completed => "completed",
            TaskStatus::Failed => "failed",
            TaskStatus::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => TaskStatus::Pending,
            "running" => TaskStatus::Running,
            "completed" => TaskStatus::Completed,
            "failed" => TaskStatus::Failed,
            "cancelled" => TaskStatus::Cancelled,
            _ => TaskStatus::Pending,
        }
    }
}

/// Task types supported by the application
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskType {
    Copy,
    Zip,
    Tar,
    Transcode,
}

impl TaskType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskType::Copy => "copy",
            TaskType::Zip => "zip",
            TaskType::Tar => "tar",
            TaskType::Transcode => "transcode",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "copy" => Some(TaskType::Copy),
            "zip" => Some(TaskType::Zip),
            "tar" => Some(TaskType::Tar),
            "transcode" => Some(TaskType::Transcode),
            _ => None,
        }
    }
}

/// A task queue
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Queue {
    pub id: String,
    pub name: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Queue {
    pub fn status_enum(&self) -> QueueStatus {
        QueueStatus::from_str(&self.status)
    }
}

/// Simplified queue info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueInfo {
    pub id: String,
    pub name: String,
    pub status: QueueStatus,
    pub task_count: i32,
    pub pending_count: i32,
    pub current_task: Option<TaskInfo>,
    pub created_at: String,
    pub updated_at: String,
}

/// A task in a queue
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub queue_id: String,
    pub task_type: String,
    pub config: String, // JSON string
    pub status: String,
    pub position: i32,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
}

impl Task {
    pub fn status_enum(&self) -> TaskStatus {
        TaskStatus::from_str(&self.status)
    }

    pub fn task_type_enum(&self) -> Option<TaskType> {
        TaskType::from_str(&self.task_type)
    }
}

/// Simplified task info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub id: String,
    pub queue_id: String,
    pub task_type: TaskType,
    pub config: serde_json::Value,
    pub status: TaskStatus,
    pub position: i32,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
}

impl From<Task> for TaskInfo {
    fn from(task: Task) -> Self {
        TaskInfo {
            id: task.id.clone(),
            queue_id: task.queue_id.clone(),
            task_type: task.task_type_enum().unwrap_or(TaskType::Copy),
            config: serde_json::from_str(&task.config).unwrap_or(serde_json::Value::Null),
            status: task.status_enum(),
            position: task.position,
            created_at: task.created_at,
            started_at: task.started_at,
            completed_at: task.completed_at,
            error_message: task.error_message,
        }
    }
}

/// Historical record of a completed task
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskHistory {
    pub id: i64,
    pub original_task_id: String,
    pub queue_id: String,
    pub queue_name: String,
    pub task_type: String,
    pub config: String,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
    pub bytes_processed: Option<i64>,
    pub duration_ms: Option<i64>,
}

/// Simplified history info for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskHistoryInfo {
    pub id: i64,
    pub original_task_id: String,
    pub queue_id: String,
    pub queue_name: String,
    pub task_type: TaskType,
    pub config: serde_json::Value,
    pub status: TaskStatus,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
    pub bytes_processed: Option<i64>,
    pub duration_ms: Option<i64>,
}

impl From<TaskHistory> for TaskHistoryInfo {
    fn from(h: TaskHistory) -> Self {
        TaskHistoryInfo {
            id: h.id,
            original_task_id: h.original_task_id,
            queue_id: h.queue_id,
            queue_name: h.queue_name,
            task_type: TaskType::from_str(&h.task_type).unwrap_or(TaskType::Copy),
            config: serde_json::from_str(&h.config).unwrap_or(serde_json::Value::Null),
            status: TaskStatus::from_str(&h.status),
            started_at: h.started_at,
            completed_at: h.completed_at,
            error_message: h.error_message,
            bytes_processed: h.bytes_processed,
            duration_ms: h.duration_ms,
        }
    }
}

// ============================================================================
// Task Configuration Types
// ============================================================================

/// Configuration for a copy task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyConfig {
    pub source: String,
    pub destination: String,
}

/// Configuration for a zip task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZipConfig {
    pub inputs: Vec<String>,
    pub output: String,
}

/// Configuration for a tar task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TarConfig {
    pub inputs: Vec<String>,
    pub output: String,
    pub gzip: bool,
}

/// Configuration for a video transcode task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscodeConfig {
    pub input: String,
    pub output: String,
    pub codec: String,
    pub preset: String,
    pub crf: Option<u8>,
    pub resolution: Option<String>,
    pub audio_codec: Option<String>,
    pub extra_args: Option<Vec<String>>,
}

impl Default for TranscodeConfig {
    fn default() -> Self {
        Self {
            input: String::new(),
            output: String::new(),
            codec: "libx264".to_string(),
            preset: "medium".to_string(),
            crf: Some(23),
            resolution: None,
            audio_codec: Some("aac".to_string()),
            extra_args: None,
        }
    }
}

// ============================================================================
// Progress Reporting
// ============================================================================

/// Progress update for a running task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskProgress {
    pub task_id: String,
    pub queue_id: String,
    pub bytes_processed: u64,
    pub total_bytes: Option<u64>,
    pub percentage: Option<f32>,
    pub current_file: Option<String>,
    pub message: Option<String>,
}

/// Event payload for task completion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCompleted {
    pub task_id: String,
    pub queue_id: String,
    pub status: TaskStatus,
    pub error_message: Option<String>,
    pub bytes_processed: u64,
    pub duration_ms: i64,
}

/// Event payload for queue status change
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStatusChanged {
    pub queue_id: String,
    pub status: QueueStatus,
}
