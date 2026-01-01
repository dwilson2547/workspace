use serde_json::Value;
use sqlx::{Pool, Sqlite};
use std::sync::Arc;
use tauri::State;
use tracing::{debug, info};

use crate::db;
use crate::db::models::*;
use crate::queue::QueueManager;
use crate::tasks::transcode;

/// Application state
pub struct AppState {
    pub pool: Pool<Sqlite>,
    pub queue_manager: Arc<QueueManager>,
}

// ============================================================================
// Queue Commands
// ============================================================================

/// Create a new task queue
#[tauri::command]
pub async fn create_queue(state: State<'_, AppState>, name: String) -> Result<QueueInfo, String> {
    info!("Creating queue: {}", name);

    let queue = db::create_queue(&state.pool, &name)
        .await
        .map_err(|e| format!("Failed to create queue: {}", e))?;

    db::get_queue_info(&state.pool, &queue.id)
        .await
        .map_err(|e| format!("Failed to get queue info: {}", e))
}

/// Get all queues
#[tauri::command]
pub async fn get_queues(state: State<'_, AppState>) -> Result<Vec<QueueInfo>, String> {
    debug!("Getting all queues");

    db::get_all_queue_infos(&state.pool)
        .await
        .map_err(|e| format!("Failed to get queues: {}", e))
}

/// Get a single queue by ID
#[tauri::command]
pub async fn get_queue(state: State<'_, AppState>, queue_id: String) -> Result<QueueInfo, String> {
    debug!("Getting queue: {}", queue_id);

    db::get_queue_info(&state.pool, &queue_id)
        .await
        .map_err(|e| format!("Failed to get queue: {}", e))
}

/// Resume a paused queue
#[tauri::command]
pub async fn resume_queue(state: State<'_, AppState>, queue_id: String) -> Result<(), String> {
    info!("Resuming queue: {}", queue_id);
    state.queue_manager.resume_queue(&queue_id).await
}

/// Pause a running queue
#[tauri::command]
pub async fn pause_queue(state: State<'_, AppState>, queue_id: String) -> Result<(), String> {
    info!("Pausing queue: {}", queue_id);
    state.queue_manager.pause_queue(&queue_id).await
}

/// Delete a queue and all its tasks
#[tauri::command]
pub async fn delete_queue(state: State<'_, AppState>, queue_id: String) -> Result<(), String> {
    info!("Deleting queue: {}", queue_id);

    // First pause if running
    if state.queue_manager.is_queue_running(&queue_id) {
        state.queue_manager.pause_queue(&queue_id).await?;
    }

    db::delete_queue(&state.pool, &queue_id)
        .await
        .map_err(|e| format!("Failed to delete queue: {}", e))
}

/// Rename a queue
#[tauri::command]
pub async fn rename_queue(
    state: State<'_, AppState>,
    queue_id: String,
    name: String,
) -> Result<(), String> {
    info!("Renaming queue {} to: {}", queue_id, name);

    db::rename_queue(&state.pool, &queue_id, &name)
        .await
        .map_err(|e| format!("Failed to rename queue: {}", e))
}

// ============================================================================
// Task Commands
// ============================================================================

/// Add a task to a queue
#[tauri::command]
pub async fn add_task(
    state: State<'_, AppState>,
    queue_id: String,
    task_type: String,
    config: Value,
) -> Result<TaskInfo, String> {
    info!("Adding {} task to queue: {}", task_type, queue_id);

    let task_type_enum = TaskType::from_str(&task_type)
        .ok_or_else(|| format!("Unknown task type: {}", task_type))?;

    // Validate config
    state
        .queue_manager
        .executors()
        .validate_config(&task_type_enum, &config)?;

    let task = db::add_task(&state.pool, &queue_id, task_type_enum, config)
        .await
        .map_err(|e| format!("Failed to add task: {}", e))?;

    Ok(task.into())
}

/// Get all tasks in a queue
#[tauri::command]
pub async fn get_queue_tasks(
    state: State<'_, AppState>,
    queue_id: String,
) -> Result<Vec<TaskInfo>, String> {
    debug!("Getting tasks for queue: {}", queue_id);

    let tasks = db::get_queue_tasks(&state.pool, &queue_id)
        .await
        .map_err(|e| format!("Failed to get tasks: {}", e))?;

    Ok(tasks.into_iter().map(|t| t.into()).collect())
}

/// Delete a pending task
#[tauri::command]
pub async fn delete_task(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    info!("Deleting task: {}", task_id);

    db::delete_task(&state.pool, &task_id)
        .await
        .map_err(|e| format!("Failed to delete task: {}", e))
}

/// Reorder a task within its queue
#[tauri::command]
pub async fn reorder_task(
    state: State<'_, AppState>,
    task_id: String,
    new_position: i32,
) -> Result<(), String> {
    info!("Reordering task {} to position {}", task_id, new_position);

    db::reorder_task(&state.pool, &task_id, new_position)
        .await
        .map_err(|e| format!("Failed to reorder task: {}", e))
}

// ============================================================================
// History Commands
// ============================================================================

/// Get task history
#[tauri::command]
pub async fn get_history(
    state: State<'_, AppState>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<TaskHistoryInfo>, String> {
    debug!("Getting task history");

    let history = db::get_task_history(&state.pool, limit.unwrap_or(50), offset.unwrap_or(0))
        .await
        .map_err(|e| format!("Failed to get history: {}", e))?;

    Ok(history.into_iter().map(|h| h.into()).collect())
}

/// Get task history for a specific queue
#[tauri::command]
pub async fn get_queue_history(
    state: State<'_, AppState>,
    queue_id: String,
    limit: Option<i32>,
) -> Result<Vec<TaskHistoryInfo>, String> {
    debug!("Getting history for queue: {}", queue_id);

    let history = db::get_queue_history(&state.pool, &queue_id, limit.unwrap_or(50))
        .await
        .map_err(|e| format!("Failed to get queue history: {}", e))?;

    Ok(history.into_iter().map(|h| h.into()).collect())
}

/// Clear all history
#[tauri::command]
pub async fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    info!("Clearing task history");

    db::clear_history(&state.pool)
        .await
        .map_err(|e| format!("Failed to clear history: {}", e))
}

/// Get history statistics
#[tauri::command]
pub async fn get_history_stats(
    state: State<'_, AppState>,
) -> Result<HistoryStats, String> {
    debug!("Getting history stats");

    let (total, completed, failed, bytes) = db::get_history_stats(&state.pool)
        .await
        .map_err(|e| format!("Failed to get history stats: {}", e))?;

    Ok(HistoryStats {
        total_tasks: total,
        completed_tasks: completed,
        failed_tasks: failed,
        total_bytes_processed: bytes,
    })
}

#[derive(serde::Serialize)]
pub struct HistoryStats {
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub failed_tasks: i64,
    pub total_bytes_processed: i64,
}

// ============================================================================
// Utility Commands
// ============================================================================

/// Check if FFmpeg is available
#[tauri::command]
pub async fn check_ffmpeg() -> Result<bool, String> {
    Ok(transcode::check_ffmpeg_available().await)
}

/// Get available video encoders
#[tauri::command]
pub async fn get_available_encoders() -> Result<Vec<String>, String> {
    Ok(transcode::get_available_encoders().await)
}

/// Validate a task configuration
#[tauri::command]
pub async fn validate_task_config(
    state: State<'_, AppState>,
    task_type: String,
    config: Value,
) -> Result<(), String> {
    let task_type_enum = TaskType::from_str(&task_type)
        .ok_or_else(|| format!("Unknown task type: {}", task_type))?;

    state
        .queue_manager
        .executors()
        .validate_config(&task_type_enum, &config)
}
