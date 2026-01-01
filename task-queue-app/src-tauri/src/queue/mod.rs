use parking_lot::RwLock;
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;
use tracing::{debug, error, info};

use crate::db;
use crate::db::models::{QueueStatus, QueueStatusChanged, TaskCompleted, TaskProgress, TaskStatus};
use crate::tasks::ExecutorRegistry;

/// Manages all task queues and their execution
pub struct QueueManager {
    /// Database connection pool
    pool: Pool<Sqlite>,

    /// Registry of task executors
    executors: Arc<ExecutorRegistry>,

    /// Running state for each queue (queue_id -> should_continue flag)
    queue_flags: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,

    /// Tauri app handle for emitting events
    app_handle: AppHandle,
}

impl QueueManager {
    pub fn new(pool: Pool<Sqlite>, app_handle: AppHandle) -> Self {
        Self {
            pool,
            executors: Arc::new(ExecutorRegistry::new()),
            queue_flags: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
        }
    }

    /// Resume a paused queue
    pub async fn resume_queue(&self, queue_id: &str) -> Result<(), String> {
        info!("Resuming queue: {}", queue_id);

        // Check if queue exists and is paused
        let queue = db::get_queue(&self.pool, queue_id)
            .await
            .map_err(|e| format!("Queue not found: {}", e))?;

        if queue.status_enum() == QueueStatus::Running {
            return Err("Queue is already running".to_string());
        }

        // Update database status
        db::set_queue_status(&self.pool, queue_id, QueueStatus::Running)
            .await
            .map_err(|e| format!("Failed to update queue status: {}", e))?;

        // Create or reset the run flag
        let run_flag = Arc::new(AtomicBool::new(true));
        {
            let mut flags = self.queue_flags.write();
            flags.insert(queue_id.to_string(), run_flag.clone());
        }

        // Emit status change event
        self.emit_queue_status_changed(queue_id, QueueStatus::Running);

        // Start processing in background
        let pool = self.pool.clone();
        let executors = self.executors.clone();
        let app_handle = self.app_handle.clone();
        let queue_id_owned = queue_id.to_string();
        let queue_flags = self.queue_flags.clone();

        tokio::spawn(async move {
            process_queue(
                &pool,
                &executors,
                &queue_id_owned,
                run_flag,
                &app_handle,
                queue_flags,
            )
            .await;
        });

        Ok(())
    }

    /// Pause a running queue (will finish current task first)
    pub async fn pause_queue(&self, queue_id: &str) -> Result<(), String> {
        info!("Pausing queue: {}", queue_id);

        // Set the flag to stop after current task
        {
            let flags = self.queue_flags.read();
            if let Some(flag) = flags.get(queue_id) {
                flag.store(false, Ordering::SeqCst);
                info!("Set pause flag for queue: {}", queue_id);
            }
        }

        // Update database status immediately
        // (The actual pause will happen after current task completes)
        db::set_queue_status(&self.pool, queue_id, QueueStatus::Paused)
            .await
            .map_err(|e| format!("Failed to update queue status: {}", e))?;

        // Emit status change event
        self.emit_queue_status_changed(queue_id, QueueStatus::Paused);

        Ok(())
    }

    /// Check if a queue is currently running
    pub fn is_queue_running(&self, queue_id: &str) -> bool {
        let flags = self.queue_flags.read();
        flags
            .get(queue_id)
            .map(|f| f.load(Ordering::SeqCst))
            .unwrap_or(false)
    }

    /// Get the executor registry for config validation
    pub fn executors(&self) -> &ExecutorRegistry {
        &self.executors
    }

    /// Emit queue status changed event
    fn emit_queue_status_changed(&self, queue_id: &str, status: QueueStatus) {
        let event = QueueStatusChanged {
            queue_id: queue_id.to_string(),
            status,
        };

        if let Err(e) = self.app_handle.emit_all("queue-status-changed", &event) {
            error!("Failed to emit queue status event: {}", e);
        }
    }
}

/// Process tasks in a queue until paused or empty
async fn process_queue(
    pool: &Pool<Sqlite>,
    executors: &ExecutorRegistry,
    queue_id: &str,
    run_flag: Arc<AtomicBool>,
    app_handle: &AppHandle,
    queue_flags: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
) {
    info!("Queue processor started for: {}", queue_id);

    loop {
        // Check if we should continue BEFORE getting next task
        if !run_flag.load(Ordering::SeqCst) {
            info!("Queue {} paused by flag", queue_id);
            break;
        }

        // Get next pending task
        let task = match db::get_next_pending_task(pool, queue_id).await {
            Ok(Some(task)) => task,
            Ok(None) => {
                info!("Queue {} has no more tasks, auto-pausing", queue_id);
                // Auto-pause when empty
                if let Err(e) = db::set_queue_status(pool, queue_id, QueueStatus::Paused).await {
                    error!("Failed to auto-pause queue: {}", e);
                }

                // Emit status change
                let event = QueueStatusChanged {
                    queue_id: queue_id.to_string(),
                    status: QueueStatus::Paused,
                };
                let _ = app_handle.emit_all("queue-status-changed", &event);

                break;
            }
            Err(e) => {
                error!("Failed to get next task: {}", e);
                break;
            }
        };

        info!("Processing task: {} (type: {})", task.id, task.task_type);

        // Get the executor
        let task_type = match task.task_type_enum() {
            Some(t) => t,
            None => {
                let error_msg = format!("Unknown task type: {}", task.task_type);
                error!("{}", error_msg);

                let _ = db::complete_task(
                    pool,
                    &task.id,
                    TaskStatus::Failed,
                    Some(&error_msg),
                    0,
                    0,
                )
                .await;

                let event = TaskCompleted {
                    task_id: task.id.clone(),
                    queue_id: queue_id.to_string(),
                    status: TaskStatus::Failed,
                    error_message: Some(error_msg),
                    bytes_processed: 0,
                    duration_ms: 0,
                };
                let _ = app_handle.emit_all("task-completed", &event);

                continue;
            }
        };

        let executor = match executors.get(&task_type) {
            Some(e) => e,
            None => {
                let error_msg = format!("No executor registered for task type: {:?}", task_type);
                error!("{}", error_msg);

                let _ = db::complete_task(
                    pool,
                    &task.id,
                    TaskStatus::Failed,
                    Some(&error_msg),
                    0,
                    0,
                )
                .await;

                let event = TaskCompleted {
                    task_id: task.id.clone(),
                    queue_id: queue_id.to_string(),
                    status: TaskStatus::Failed,
                    error_message: Some(error_msg),
                    bytes_processed: 0,
                    duration_ms: 0,
                };
                let _ = app_handle.emit_all("task-completed", &event);

                continue;
            }
        };

        // Parse config
        let config: serde_json::Value = match serde_json::from_str(&task.config) {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to parse task config: {}", e);
                // Mark task as failed
                let _ = db::complete_task(
                    pool,
                    &task.id,
                    TaskStatus::Failed,
                    Some(&format!("Invalid config: {}", e)),
                    0,
                    0,
                )
                .await;
                continue;
            }
        };

        // Mark task as running
        if let Err(e) = db::start_task(pool, &task.id).await {
            error!("Failed to mark task as running: {}", e);
            // Avoid tight loops if the DB is unhealthy; pause the queue.
            let _ = db::set_queue_status(pool, queue_id, QueueStatus::Paused).await;
            let event = QueueStatusChanged {
                queue_id: queue_id.to_string(),
                status: QueueStatus::Paused,
            };
            let _ = app_handle.emit_all("queue-status-changed", &event);
            break;
        }

        // Create progress channel
        let (progress_tx, mut progress_rx) = mpsc::unbounded_channel::<TaskProgress>();

        // Forward progress events to frontend
        let app_handle_clone = app_handle.clone();
        let task_id_for_progress = task.id.clone();
        let progress_forwarder = tokio::spawn(async move {
            while let Some(progress) = progress_rx.recv().await {
                // Serialize event emission to prevent concurrent access
                let handle = app_handle_clone.clone();
                let task_id = task_id_for_progress.clone();
                tokio::task::spawn_blocking(move || {
                    if let Err(e) = handle.emit_all("task-progress", &progress) {
                        debug!("Failed to emit progress for task {}: {}", task_id, e);
                    }
                });
            }
            debug!("Progress forwarder finished for task {}", task_id_for_progress);
        });

        // Execute the task
        let start_time = Instant::now();
        let result = executor
            .execute(&task.id, queue_id, &config, progress_tx)
            .await;
        let duration_ms = start_time.elapsed().as_millis() as i64;

        // Wait for forwarder to finish properly (progress_tx is dropped after execute)
        let _ = tokio::time::timeout(
            tokio::time::Duration::from_secs(2),
            progress_forwarder
        ).await;

        // Handle result
        match result {
            Ok(task_result) => {
                info!(
                    "Task {} completed: {} bytes in {}ms",
                    task.id, task_result.bytes_processed, duration_ms
                );

                if let Err(e) = db::complete_task(
                    pool,
                    &task.id,
                    TaskStatus::Completed,
                    None,
                    task_result.bytes_processed,
                    duration_ms,
                )
                .await
                {
                    error!("Failed to complete task: {}", e);
                }

                // Emit completion event
                let event = TaskCompleted {
                    task_id: task.id.clone(),
                    queue_id: queue_id.to_string(),
                    status: TaskStatus::Completed,
                    error_message: None,
                    bytes_processed: task_result.bytes_processed,
                    duration_ms,
                };
                let handle = app_handle.clone();
                tokio::task::spawn_blocking(move || {
                    let _ = handle.emit_all("task-completed", &event);
                });
            }
            Err(e) => {
                let error_msg = e.to_string();
                error!("Task {} failed: {}", task.id, error_msg);

                if let Err(e) = db::complete_task(
                    pool,
                    &task.id,
                    TaskStatus::Failed,
                    Some(&error_msg),
                    0,
                    duration_ms,
                )
                .await
                {
                    error!("Failed to mark task as failed: {}", e);
                }

                // Emit completion event
                let event = TaskCompleted {
                    task_id: task.id.clone(),
                    queue_id: queue_id.to_string(),
                    status: TaskStatus::Failed,
                    error_message: Some(error_msg),
                    bytes_processed: 0,
                    duration_ms,
                };
                let handle = app_handle.clone();
                tokio::task::spawn_blocking(move || {
                    let _ = handle.emit_all("task-completed", &event);
                });
            }
        }

        // Periodically prune history to prevent unbounded database growth
        // Keep the most recent 1000 entries
        static TASK_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let count = TASK_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if count % 50 == 0 {
            // Every 50 tasks, prune history
            if let Ok(deleted) = db::prune_old_history(pool, 1000).await {
                if deleted > 0 {
                    info!("Pruned {} old history entries", deleted);
                }
            }
        }

        // Longer delay between tasks to prevent FFmpeg process contention
        // Especially important for batch operations - ensure previous FFmpeg is fully dead
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }

    // Clean up the flag
    {
        let mut flags = queue_flags.write();
        flags.remove(queue_id);
    }

    info!("Queue processor stopped for: {}", queue_id);
}
