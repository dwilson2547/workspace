pub mod models;

use sqlx::{Pool, Sqlite, SqlitePool};
use std::path::Path;
use tracing::info;
use uuid::Uuid;

use models::*;

/// Initialize the database, creating tables if they don't exist
pub async fn init_database(db_path: &Path) -> Result<Pool<Sqlite>, sqlx::Error> {
    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    info!("Connecting to database at: {}", db_url);

    let pool = SqlitePool::connect(&db_url).await?;

    // Run migrations
    run_migrations(&pool).await?;

    // Reset any tasks that were stuck in "running" state after a crash
    reset_stuck_tasks(&pool).await?;

    Ok(pool)
}

/// Run database migrations
async fn run_migrations(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
    info!("Running database migrations...");

    // Create queues table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS queues (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'paused',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create tasks table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY NOT NULL,
            queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
            task_type TEXT NOT NULL,
            config TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            position INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            started_at TEXT,
            completed_at TEXT,
            error_message TEXT
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create task_history table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS task_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_task_id TEXT NOT NULL,
            queue_id TEXT NOT NULL,
            queue_name TEXT NOT NULL,
            task_type TEXT NOT NULL,
            config TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            error_message TEXT,
            bytes_processed INTEGER,
            duration_ms INTEGER
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create indexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_queue_id ON tasks(queue_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(queue_id, position)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_history_queue_id ON task_history(queue_id)")
        .execute(pool)
        .await?;

    info!("Database migrations completed successfully");
    Ok(())
}

/// Mark any tasks that were stuck in "running" state after a crash as failed
/// This should be called during database initialization
async fn reset_stuck_tasks(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
    // Find all tasks that were running when the app crashed
    let stuck_tasks: Vec<Task> = sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE status = 'running'"
    )
    .fetch_all(pool)
    .await?;

    if stuck_tasks.is_empty() {
        return Ok(());
    }

    info!("Found {} stuck task(s) in 'running' state, marking as failed", stuck_tasks.len());

    for task in stuck_tasks {
        // Calculate duration if we have a start time
        let duration_ms = if let Some(started_at) = &task.started_at {
            if let Ok(started) = chrono::DateTime::parse_from_str(
                &format!("{} +00:00", started_at),
                "%Y-%m-%d %H:%M:%S %z"
            ) {
                let now = chrono::Utc::now();
                (now.timestamp_millis() - started.timestamp_millis()).max(0)
            } else {
                0
            }
        } else {
            0
        };

        // Mark the task as failed and move to history
        if let Err(e) = complete_task(
            pool,
            &task.id,
            TaskStatus::Failed,
            Some("Task interrupted by application crash"),
            0,
            duration_ms,
        ).await {
            // Log but don't fail the entire initialization
            tracing::error!("Failed to mark crashed task {} as failed: {}", task.id, e);
        }
    }

    info!("Successfully marked all crashed tasks as failed");
    Ok(())
}

// ============================================================================
// Queue Operations
// ============================================================================

/// Create a new queue (paused by default)
pub async fn create_queue(pool: &Pool<Sqlite>, name: &str) -> Result<Queue, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        r#"
        INSERT INTO queues (id, name, status, created_at, updated_at)
        VALUES (?, ?, 'paused', ?, ?)
        "#,
    )
    .bind(&id)
    .bind(name)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;

    get_queue(pool, &id).await
}

/// Get a queue by ID
pub async fn get_queue(pool: &Pool<Sqlite>, id: &str) -> Result<Queue, sqlx::Error> {
    sqlx::query_as::<_, Queue>("SELECT * FROM queues WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

/// Get all queues
pub async fn get_all_queues(pool: &Pool<Sqlite>) -> Result<Vec<Queue>, sqlx::Error> {
    sqlx::query_as::<_, Queue>("SELECT * FROM queues ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
}

/// Get queue info with task counts
pub async fn get_queue_info(pool: &Pool<Sqlite>, id: &str) -> Result<QueueInfo, sqlx::Error> {
    let queue = get_queue(pool, id).await?;

    let task_count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM tasks WHERE queue_id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;

    let pending_count: (i32,) =
        sqlx::query_as("SELECT COUNT(*) FROM tasks WHERE queue_id = ? AND status = 'pending'")
            .bind(id)
            .fetch_one(pool)
            .await?;

    let current_task = get_running_task(pool, id).await.ok();

    Ok(QueueInfo {
        id: queue.id.clone(),
        name: queue.name.clone(),
        status: queue.status_enum(),
        task_count: task_count.0,
        pending_count: pending_count.0,
        current_task,
        created_at: queue.created_at,
        updated_at: queue.updated_at,
    })
}

/// Get all queues with info
pub async fn get_all_queue_infos(pool: &Pool<Sqlite>) -> Result<Vec<QueueInfo>, sqlx::Error> {
    let queues = get_all_queues(pool).await?;
    let mut infos = Vec::with_capacity(queues.len());

    for queue in queues {
        let info = get_queue_info(pool, &queue.id).await?;
        infos.push(info);
    }

    Ok(infos)
}

/// Update queue status
pub async fn set_queue_status(
    pool: &Pool<Sqlite>,
    id: &str,
    status: QueueStatus,
) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query("UPDATE queues SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status.as_str())
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Delete a queue and all its tasks
pub async fn delete_queue(pool: &Pool<Sqlite>, id: &str) -> Result<(), sqlx::Error> {
    // Tasks will be deleted via CASCADE
    sqlx::query("DELETE FROM queues WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Rename a queue
pub async fn rename_queue(pool: &Pool<Sqlite>, id: &str, name: &str) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query("UPDATE queues SET name = ?, updated_at = ? WHERE id = ?")
        .bind(name)
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

// ============================================================================
// Task Operations
// ============================================================================

/// Add a task to a queue
pub async fn add_task(
    pool: &Pool<Sqlite>,
    queue_id: &str,
    task_type: TaskType,
    config: serde_json::Value,
) -> Result<Task, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let config_str = serde_json::to_string(&config).unwrap_or_default();

    // Get the next position
    let max_pos: (Option<i32>,) =
        sqlx::query_as("SELECT MAX(position) FROM tasks WHERE queue_id = ?")
            .bind(queue_id)
            .fetch_one(pool)
            .await?;

    let position = max_pos.0.unwrap_or(-1) + 1;

    sqlx::query(
        r#"
        INSERT INTO tasks (id, queue_id, task_type, config, status, position, created_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
        "#,
    )
    .bind(&id)
    .bind(queue_id)
    .bind(task_type.as_str())
    .bind(&config_str)
    .bind(position)
    .bind(&now)
    .execute(pool)
    .await?;

    // Update queue's updated_at
    sqlx::query("UPDATE queues SET updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(queue_id)
        .execute(pool)
        .await?;

    get_task(pool, &id).await
}

/// Get a task by ID
pub async fn get_task(pool: &Pool<Sqlite>, id: &str) -> Result<Task, sqlx::Error> {
    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

/// Get all tasks in a queue
pub async fn get_queue_tasks(pool: &Pool<Sqlite>, queue_id: &str) -> Result<Vec<Task>, sqlx::Error> {
    sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE queue_id = ? ORDER BY position ASC",
    )
    .bind(queue_id)
    .fetch_all(pool)
    .await
}

/// Get the currently running task in a queue
pub async fn get_running_task(pool: &Pool<Sqlite>, queue_id: &str) -> Result<TaskInfo, sqlx::Error> {
    let task = sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE queue_id = ? AND status = 'running' LIMIT 1",
    )
    .bind(queue_id)
    .fetch_one(pool)
    .await?;

    Ok(task.into())
}

/// Get the next pending task in a queue
pub async fn get_next_pending_task(
    pool: &Pool<Sqlite>,
    queue_id: &str,
) -> Result<Option<Task>, sqlx::Error> {
    let task = sqlx::query_as::<_, Task>(
        "SELECT * FROM tasks WHERE queue_id = ? AND status = 'pending' ORDER BY position ASC LIMIT 1",
    )
    .bind(queue_id)
    .fetch_optional(pool)
    .await?;

    Ok(task)
}

/// Update task status to running
pub async fn start_task(pool: &Pool<Sqlite>, id: &str) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query("UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?")
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Complete a task (success or failure)
pub async fn complete_task(
    pool: &Pool<Sqlite>,
    id: &str,
    status: TaskStatus,
    error_message: Option<&str>,
    bytes_processed: u64,
    duration_ms: i64,
) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Update the task
    sqlx::query(
        "UPDATE tasks SET status = ?, completed_at = ?, error_message = ? WHERE id = ?",
    )
    .bind(status.as_str())
    .bind(&now)
    .bind(error_message)
    .bind(id)
    .execute(pool)
    .await?;

    // Get task info for history
    let task = get_task(pool, id).await?;
    let queue = get_queue(pool, &task.queue_id).await?;

    // Add to history
    sqlx::query(
        r#"
        INSERT INTO task_history 
        (original_task_id, queue_id, queue_name, task_type, config, status, started_at, completed_at, error_message, bytes_processed, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&task.id)
    .bind(&task.queue_id)
    .bind(&queue.name)
    .bind(&task.task_type)
    .bind(&task.config)
    .bind(status.as_str())
    .bind(&task.started_at)
    .bind(&now)
    .bind(error_message)
    .bind(bytes_processed as i64)
    .bind(duration_ms)
    .execute(pool)
    .await?;

    // Remove from tasks table
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Delete a pending task
pub async fn delete_task(pool: &Pool<Sqlite>, id: &str) -> Result<(), sqlx::Error> {
    // Only delete if pending
    sqlx::query("DELETE FROM tasks WHERE id = ? AND status = 'pending'")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Reorder a task within its queue
pub async fn reorder_task(
    pool: &Pool<Sqlite>,
    task_id: &str,
    new_position: i32,
) -> Result<(), sqlx::Error> {
    let task = get_task(pool, task_id).await?;
    let old_position = task.position;

    if old_position == new_position {
        return Ok(());
    }

    // Shift other tasks
    if new_position < old_position {
        // Moving up: shift tasks down
        sqlx::query(
            "UPDATE tasks SET position = position + 1 WHERE queue_id = ? AND position >= ? AND position < ?",
        )
        .bind(&task.queue_id)
        .bind(new_position)
        .bind(old_position)
        .execute(pool)
        .await?;
    } else {
        // Moving down: shift tasks up
        sqlx::query(
            "UPDATE tasks SET position = position - 1 WHERE queue_id = ? AND position > ? AND position <= ?",
        )
        .bind(&task.queue_id)
        .bind(old_position)
        .bind(new_position)
        .execute(pool)
        .await?;
    }

    // Update the task's position
    sqlx::query("UPDATE tasks SET position = ? WHERE id = ?")
        .bind(new_position)
        .bind(task_id)
        .execute(pool)
        .await?;

    Ok(())
}

// ============================================================================
// History Operations
// ============================================================================

/// Get task history (most recent first)
pub async fn get_task_history(
    pool: &Pool<Sqlite>,
    limit: i32,
    offset: i32,
) -> Result<Vec<TaskHistory>, sqlx::Error> {
    sqlx::query_as::<_, TaskHistory>(
        "SELECT * FROM task_history ORDER BY completed_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
}

/// Get task history for a specific queue
pub async fn get_queue_history(
    pool: &Pool<Sqlite>,
    queue_id: &str,
    limit: i32,
) -> Result<Vec<TaskHistory>, sqlx::Error> {
    sqlx::query_as::<_, TaskHistory>(
        "SELECT * FROM task_history WHERE queue_id = ? ORDER BY completed_at DESC LIMIT ?",
    )
    .bind(queue_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

/// Clear all history
pub async fn clear_history(pool: &Pool<Sqlite>) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM task_history")
        .execute(pool)
        .await?;

    Ok(())
}

/// Prune old history entries to prevent unbounded growth
/// Keeps only the most recent N entries
pub async fn prune_old_history(pool: &Pool<Sqlite>, keep_count: i32) -> Result<i64, sqlx::Error> {
    // Delete all but the most recent keep_count entries
    let result = sqlx::query(
        r#"
        DELETE FROM task_history 
        WHERE id NOT IN (
            SELECT id FROM task_history 
            ORDER BY completed_at DESC 
            LIMIT ?
        )
        "#,
    )
    .bind(keep_count)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() as i64)
}

/// Get history statistics
pub async fn get_history_stats(
    pool: &Pool<Sqlite>,
) -> Result<(i64, i64, i64, i64), sqlx::Error> {
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM task_history")
        .fetch_one(pool)
        .await?;

    let completed: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM task_history WHERE status = 'completed'")
            .fetch_one(pool)
            .await?;

    let failed: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM task_history WHERE status = 'failed'")
            .fetch_one(pool)
            .await?;

    let total_bytes: (Option<i64>,) =
        sqlx::query_as("SELECT SUM(bytes_processed) FROM task_history WHERE status = 'completed'")
            .fetch_one(pool)
            .await?;

    Ok((total.0, completed.0, failed.0, total_bytes.0.unwrap_or(0)))
}
