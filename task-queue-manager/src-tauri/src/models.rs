//! Data models for Task Queue Manager
//! 
//! These models mirror the TypeScript types on the frontend for seamless IPC.

use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::fmt;

// =============================================================================
// Status Types
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QueueStatus {
    Idle,
    Running,
    Paused,
}

impl Default for QueueStatus {
    fn default() -> Self {
        Self::Idle
    }
}

impl fmt::Display for QueueStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Idle => write!(f, "idle"),
            Self::Running => write!(f, "running"),
            Self::Paused => write!(f, "paused"),
        }
    }
}

impl FromStr for QueueStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "idle" => Ok(Self::Idle),
            "running" => Ok(Self::Running),
            "paused" => Ok(Self::Paused),
            _ => Err(format!("Unknown queue status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl Default for TaskStatus {
    fn default() -> Self {
        Self::Pending
    }
}

impl fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Running => write!(f, "running"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl FromStr for TaskStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "running" => Ok(Self::Running),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(format!("Unknown task status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowStatus {
    Idle,
    Running,
    Paused,
}

impl Default for WorkflowStatus {
    fn default() -> Self {
        Self::Idle
    }
}

impl fmt::Display for WorkflowStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Idle => write!(f, "idle"),
            Self::Running => write!(f, "running"),
            Self::Paused => write!(f, "paused"),
        }
    }
}

impl FromStr for WorkflowStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "idle" => Ok(Self::Idle),
            "running" => Ok(Self::Running),
            "paused" => Ok(Self::Paused),
            _ => Err(format!("Unknown workflow status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowFileStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    CompletedWithErrors,
}

impl Default for WorkflowFileStatus {
    fn default() -> Self {
        Self::Pending
    }
}

impl fmt::Display for WorkflowFileStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Processing => write!(f, "processing"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::CompletedWithErrors => write!(f, "completed_with_errors"),
        }
    }
}

impl FromStr for WorkflowFileStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "processing" => Ok(Self::Processing),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            "completed_with_errors" => Ok(Self::CompletedWithErrors),
            _ => Err(format!("Unknown workflow file status: {}", s)),
        }
    }
}

// =============================================================================
// Task Types
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    // File Operations
    Copy,
    Move,
    Rename,
    Delete,
    Extract,
    // Archives
    Archive,
    // Media
    Transcode,
    Audio,
    Image,
    Thumbnail,
    Metadata,
    // Sync & Transfer
    Rsync,
    Rclone,
    FtpSftp,
    Download,
    // Advanced
    ShellCommand,
    Script,
    HttpRequest,
    // Flow Control
    Filter,
    Wait,
    Branch,
}

impl Default for TaskType {
    fn default() -> Self {
        Self::Copy
    }
}

impl fmt::Display for TaskType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Copy => write!(f, "copy"),
            Self::Move => write!(f, "move"),
            Self::Rename => write!(f, "rename"),
            Self::Delete => write!(f, "delete"),
            Self::Extract => write!(f, "extract"),
            Self::Archive => write!(f, "archive"),
            Self::Transcode => write!(f, "transcode"),
            Self::Audio => write!(f, "audio"),
            Self::Image => write!(f, "image"),
            Self::Thumbnail => write!(f, "thumbnail"),
            Self::Metadata => write!(f, "metadata"),
            Self::Rsync => write!(f, "rsync"),
            Self::Rclone => write!(f, "rclone"),
            Self::FtpSftp => write!(f, "ftp_sftp"),
            Self::Download => write!(f, "download"),
            Self::ShellCommand => write!(f, "shell_command"),
            Self::Script => write!(f, "script"),
            Self::HttpRequest => write!(f, "http_request"),
            Self::Filter => write!(f, "filter"),
            Self::Wait => write!(f, "wait"),
            Self::Branch => write!(f, "branch"),
        }
    }
}

impl FromStr for TaskType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "copy" => Ok(Self::Copy),
            "move" => Ok(Self::Move),
            "rename" => Ok(Self::Rename),
            "delete" => Ok(Self::Delete),
            "extract" => Ok(Self::Extract),
            "archive" => Ok(Self::Archive),
            "transcode" => Ok(Self::Transcode),
            "audio" => Ok(Self::Audio),
            "image" => Ok(Self::Image),
            "thumbnail" => Ok(Self::Thumbnail),
            "metadata" => Ok(Self::Metadata),
            "rsync" => Ok(Self::Rsync),
            "rclone" => Ok(Self::Rclone),
            "ftp_sftp" | "ftpsftp" => Ok(Self::FtpSftp),
            "download" => Ok(Self::Download),
            "shell_command" | "shellcommand" => Ok(Self::ShellCommand),
            "script" => Ok(Self::Script),
            "http_request" | "httprequest" => Ok(Self::HttpRequest),
            "filter" => Ok(Self::Filter),
            "wait" => Ok(Self::Wait),
            "branch" => Ok(Self::Branch),
            _ => Err(format!("Unknown task type: {}", s)),
        }
    }
}

// =============================================================================
// Queue & Task Models
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Queue {
    pub id: String,
    pub name: String,
    pub status: QueueStatus,
    pub max_parallel: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub queue_id: String,
    #[serde(rename = "type")]
    pub task_type: TaskType,
    pub config: serde_json::Value,
    pub status: TaskStatus,
    pub progress: i32,
    pub bytes_processed: Option<i64>,
    pub total_bytes: Option<i64>,
    pub error: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

// =============================================================================
// Workflow Models
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowType {
    FilePipeline,
    TaskSequence,
}

impl Default for WorkflowType {
    fn default() -> Self {
        Self::FilePipeline
    }
}

impl fmt::Display for WorkflowType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::FilePipeline => write!(f, "file_pipeline"),
            Self::TaskSequence => write!(f, "task_sequence"),
        }
    }
}

impl FromStr for WorkflowType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "file_pipeline" | "filepipeline" => Ok(Self::FilePipeline),
            "task_sequence" | "tasksequence" => Ok(Self::TaskSequence),
            _ => Err(format!("Unknown workflow type: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TriggerType {
    Manual,
    Directory,
    Watch,
}

impl Default for TriggerType {
    fn default() -> Self {
        Self::Manual
    }
}

impl fmt::Display for TriggerType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Manual => write!(f, "manual"),
            Self::Directory => write!(f, "directory"),
            Self::Watch => write!(f, "watch"),
        }
    }
}

impl FromStr for TriggerType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "manual" => Ok(Self::Manual),
            "directory" => Ok(Self::Directory),
            "watch" => Ok(Self::Watch),
            _ => Err(format!("Unknown trigger type: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionMode {
    Sequential,
    Parallel,
}

impl Default for ExecutionMode {
    fn default() -> Self {
        Self::Sequential
    }
}

impl fmt::Display for ExecutionMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sequential => write!(f, "sequential"),
            Self::Parallel => write!(f, "parallel"),
        }
    }
}

impl FromStr for ExecutionMode {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "sequential" => Ok(Self::Sequential),
            "parallel" => Ok(Self::Parallel),
            _ => Err(format!("Unknown execution mode: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorStrategy {
    Continue,
    FailFile,
    FailFileAndPause,
}

impl Default for ErrorStrategy {
    fn default() -> Self {
        Self::FailFile
    }
}

impl fmt::Display for ErrorStrategy {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Continue => write!(f, "continue"),
            Self::FailFile => write!(f, "fail_file"),
            Self::FailFileAndPause => write!(f, "fail_file_and_pause"),
        }
    }
}

impl FromStr for ErrorStrategy {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "continue" => Ok(Self::Continue),
            "fail_file" | "failfile" => Ok(Self::FailFile),
            "fail_file_and_pause" | "failfileandpause" => Ok(Self::FailFileAndPause),
            _ => Err(format!("Unknown error strategy: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecoveryStrategy {
    Retry,
    Skip,
    Ask,
}

impl Default for RecoveryStrategy {
    fn default() -> Self {
        Self::Ask
    }
}

impl fmt::Display for RecoveryStrategy {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Retry => write!(f, "retry"),
            Self::Skip => write!(f, "skip"),
            Self::Ask => write!(f, "ask"),
        }
    }
}

impl FromStr for RecoveryStrategy {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "retry" => Ok(Self::Retry),
            "skip" => Ok(Self::Skip),
            "ask" => Ok(Self::Ask),
            _ => Err(format!("Unknown recovery strategy: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

impl Default for Theme {
    fn default() -> Self {
        Self::System
    }
}

impl fmt::Display for Theme {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Light => write!(f, "light"),
            Self::Dark => write!(f, "dark"),
            Self::System => write!(f, "system"),
        }
    }
}

impl FromStr for Theme {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "light" => Ok(Self::Light),
            "dark" => Ok(Self::Dark),
            "system" => Ok(Self::System),
            _ => Err(format!("Unknown theme: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowTrigger {
    #[serde(rename = "type")]
    pub trigger_type: TriggerType,
    pub path: Option<String>,
    pub file_pattern: Option<String>,
    #[serde(default)]
    pub recursive: bool,
    pub max_depth: Option<i32>,
    #[serde(default)]
    pub process_existing_on_start: bool,
    pub existing_files_newer_than: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowExecution {
    pub mode: ExecutionMode,
    pub max_parallel: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowOutput {
    pub directory: String,
    pub name_template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRecovery {
    pub interrupted_files: RecoveryStrategy,
    #[serde(default = "default_true")]
    pub check_missed_files: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchOptions {
    #[serde(default = "default_true")]
    pub ignore_temp_files: bool,
    #[serde(default)]
    pub temp_patterns: Vec<String>,
    #[serde(default = "default_true")]
    pub ignore_hidden_files: bool,
    pub min_file_size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowTaskDefinition {
    pub id: String,
    #[serde(rename = "type")]
    pub task_type: TaskType,
    pub config: serde_json::Value,
    #[serde(default)]
    pub on_error: ErrorStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub workflow_type: WorkflowType,
    pub status: WorkflowStatus,
    pub trigger: WorkflowTrigger,
    pub execution: WorkflowExecution,
    pub output: WorkflowOutput,
    pub tasks: Vec<WorkflowTaskDefinition>,
    pub recovery: WorkflowRecovery,
    pub watch_options: Option<WatchOptions>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowFile {
    pub id: String,
    pub workflow_id: String,
    pub source_path: String,
    pub status: WorkflowFileStatus,
    #[serde(default)]
    pub task_statuses: Vec<WorkflowFileTaskStatus>,
    pub added_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowFileTaskStatus {
    pub task_id: String,
    pub status: TaskStatus,
    pub bytes_processed: Option<i64>,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

// =============================================================================
// Settings & Presets
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadDefaults {
    pub default_user_context_id: Option<String>,
    #[serde(default)]
    pub default_header_preset_ids: Vec<String>,
    #[serde(default = "default_timeout")]
    pub default_timeout: i32,
    #[serde(default = "default_retry")]
    pub default_retry_attempts: i32,
    #[serde(default = "default_concurrent")]
    pub default_max_concurrent: i32,
}

fn default_timeout() -> i32 { 30 }
fn default_retry() -> i32 { 3 }
fn default_concurrent() -> i32 { 3 }

impl Default for DownloadDefaults {
    fn default() -> Self {
        Self {
            default_user_context_id: None,
            default_header_preset_ids: Vec::new(),
            default_timeout: 30,
            default_retry_attempts: 3,
            default_max_concurrent: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub pause_all_on_startup: bool,
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub download_defaults: DownloadDefaults,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            pause_all_on_startup: false,
            theme: Theme::System,
            download_defaults: DownloadDefaults::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserContext {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub is_built_in: bool,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderPreset {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskTemplate {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub base_task: TaskType,
    pub config: serde_json::Value,
    #[serde(default)]
    pub locked_fields: Vec<String>,
}

// =============================================================================
// Dependency Models
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    pub name: String,
    pub binary: String,
    #[serde(default)]
    pub check_command: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub used_by: Vec<TaskType>,
    pub available: bool,
    pub version: Option<String>,
}

// =============================================================================
// Event Types (for Tauri events)
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgressEvent {
    pub task_id: String,
    pub progress: i32,
    pub bytes_processed: Option<i64>,
    pub total_bytes: Option<i64>,
    pub status: TaskStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueStatusEvent {
    pub queue_id: String,
    pub status: QueueStatus,
    pub running_count: i32,
    pub pending_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStatusEvent {
    pub workflow_id: String,
    pub status: WorkflowStatus,
    pub active_files: i32,
    pub pending_files: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub task_id: String,
    pub url_index: i32,
    pub url: String,
    pub bytes_downloaded: i64,
    pub total_bytes: Option<i64>,
    pub speed: i64,
    pub status: String,
    pub error: Option<String>,
}
