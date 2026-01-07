use serde::Serialize;
use std::fmt;

/// Application error types
#[derive(Debug, Clone, Serialize)]
pub enum AppError {
    /// Database-related errors
    Database(String),
    /// Validation errors
    Validation(String),
    /// Not found errors
    NotFound(String),
    /// IO errors
    Io(String),
    /// Task execution errors
    TaskExecution(String),
    /// Dependency errors (missing ffmpeg, etc.)
    Dependency(String),
    /// Configuration errors
    Config(String),
    /// Network/download errors
    Network(String),
    /// General internal errors
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Database(msg) => write!(f, "Database error: {}", msg),
            AppError::Validation(msg) => write!(f, "Validation error: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::Io(msg) => write!(f, "IO error: {}", msg),
            AppError::TaskExecution(msg) => write!(f, "Task execution error: {}", msg),
            AppError::Dependency(msg) => write!(f, "Dependency error: {}", msg),
            AppError::Config(msg) => write!(f, "Configuration error: {}", msg),
            AppError::Network(msg) => write!(f, "Network error: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Internal(format!("JSON error: {}", err))
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Network(err.to_string())
    }
}

/// Result type alias for application operations
pub type AppResult<T> = Result<T, AppError>;

/// Convert AppError to a serializable format for Tauri commands
impl AppError {
    pub fn to_command_error(&self) -> String {
        self.to_string()
    }
}
