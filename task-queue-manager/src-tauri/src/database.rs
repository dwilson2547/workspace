use rusqlite::{Connection, params};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use crate::error::{AppError, AppResult};
use crate::models::*;

/// Global database instance
static DB: OnceLock<Database> = OnceLock::new();

/// Path to the database file (for Tauri state)
pub struct DbPath(pub PathBuf);

/// Initialize the global database instance
pub fn init(path: &Path) -> AppResult<()> {
    let db = Database::new(path)?;
    DB.set(db).map_err(|_| AppError::Database("Database already initialized".to_string()))?;
    Ok(())
}

/// Get a reference to the global database instance
pub fn get() -> AppResult<&'static Database> {
    DB.get().ok_or_else(|| AppError::Database("Database not initialized".to_string()))
}

/// Database manager for SQLite operations
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Create a new database connection
    pub fn new(path: &Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        
        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };
        
        db.initialize_schema()?;
        Ok(db)
    }
    
    /// Create an in-memory database (for testing)
    pub fn in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        
        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };
        
        db.initialize_schema()?;
        Ok(db)
    }
    
    /// Initialize the database schema
    fn initialize_schema(&self) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        
        conn.execute_batch(r#"
            -- Application settings
            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                pause_all_on_startup INTEGER NOT NULL DEFAULT 1,
                theme TEXT NOT NULL DEFAULT 'system',
                default_user_context_id TEXT,
                default_header_preset_ids TEXT DEFAULT '[]',
                default_timeout INTEGER NOT NULL DEFAULT 30,
                default_retry_attempts INTEGER NOT NULL DEFAULT 3,
                default_max_concurrent INTEGER NOT NULL DEFAULT 3,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            -- Insert default settings if not exists
            INSERT OR IGNORE INTO app_settings (id) VALUES (1);

            -- Queues
            CREATE TABLE IF NOT EXISTS queues (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'idle',
                max_parallel INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- Tasks
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                config TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                bytes_processed INTEGER,
                total_bytes INTEGER,
                error TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_queue_id ON tasks(queue_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

            -- Workflows
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'idle',
                trigger_type TEXT NOT NULL,
                trigger_path TEXT,
                trigger_pattern TEXT,
                trigger_recursive INTEGER DEFAULT 0,
                trigger_max_depth INTEGER,
                trigger_process_existing INTEGER DEFAULT 0,
                trigger_newer_than TEXT,
                execution_mode TEXT NOT NULL DEFAULT 'sequential',
                execution_max_parallel INTEGER DEFAULT 1,
                output_directory TEXT,
                output_name_template TEXT,
                recovery_interrupted TEXT DEFAULT 'ask',
                recovery_check_missed INTEGER DEFAULT 1,
                watch_ignore_temp INTEGER DEFAULT 1,
                watch_temp_patterns TEXT DEFAULT '[".tmp", ".part", ".crdownload", "~$*"]',
                watch_ignore_hidden INTEGER DEFAULT 1,
                watch_min_file_size INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- Workflow Task Definitions
            CREATE TABLE IF NOT EXISTS workflow_tasks (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                position INTEGER NOT NULL,
                task_type TEXT NOT NULL,
                config TEXT NOT NULL,
                on_error TEXT NOT NULL DEFAULT 'fail_file',
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflow_id ON workflow_tasks(workflow_id);

            -- Files Being Processed by Workflows
            CREATE TABLE IF NOT EXISTS workflow_files (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                source_path TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                added_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_files_workflow_id ON workflow_files(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_workflow_files_status ON workflow_files(status);

            -- Per-Task Status for Each File
            CREATE TABLE IF NOT EXISTS workflow_file_tasks (
                id TEXT PRIMARY KEY,
                workflow_file_id TEXT NOT NULL REFERENCES workflow_files(id) ON DELETE CASCADE,
                workflow_task_id TEXT NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                bytes_processed INTEGER,
                started_at TEXT,
                completed_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_file_tasks_file_id ON workflow_file_tasks(workflow_file_id);

            -- History of Processed Files (for watch deduplication)
            CREATE TABLE IF NOT EXISTS workflow_processed_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                file_path TEXT NOT NULL,
                file_hash TEXT,
                processed_at TEXT NOT NULL,
                UNIQUE(workflow_id, file_path)
            );

            CREATE INDEX IF NOT EXISTS idx_processed_files_workflow ON workflow_processed_files(workflow_id);

            -- Custom Task Templates
            CREATE TABLE IF NOT EXISTS task_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                icon TEXT,
                base_task TEXT NOT NULL,
                config TEXT NOT NULL,
                locked_fields TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- User-Created User Contexts (built-in loaded from JSON file)
            CREATE TABLE IF NOT EXISTS user_contexts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                headers TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- Header Presets
            CREATE TABLE IF NOT EXISTS header_presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                headers TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- Dependency status cache
            CREATE TABLE IF NOT EXISTS dependencies (
                name TEXT PRIMARY KEY,
                binary_name TEXT NOT NULL,
                available INTEGER NOT NULL DEFAULT 0,
                version TEXT,
                last_checked TEXT NOT NULL
            );
        "#)?;
        
        Ok(())
    }

    // ==================== Queue Operations ====================

    /// Get all queues
    pub fn get_queues(&self) -> AppResult<Vec<Queue>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, status, max_parallel, created_at, updated_at FROM queues ORDER BY created_at DESC"
        )?;
        
        let queues = stmt.query_map([], |row| {
            Ok(Queue {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get::<_, String>(2)?.parse().unwrap_or(QueueStatus::Idle),
                max_parallel: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(queues)
    }

    /// Get a queue by ID
    pub fn get_queue(&self, id: &str) -> AppResult<Queue> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, status, max_parallel, created_at, updated_at FROM queues WHERE id = ?"
        )?;
        
        stmt.query_row([id], |row| {
            Ok(Queue {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get::<_, String>(2)?.parse().unwrap_or(QueueStatus::Idle),
                max_parallel: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        }).map_err(|_| AppError::NotFound(format!("Queue not found: {}", id)))
    }

    /// Create a new queue
    pub fn create_queue(&self, queue: &Queue) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        conn.execute(
            "INSERT INTO queues (id, name, status, max_parallel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            params![queue.id, queue.name, queue.status.to_string(), queue.max_parallel, queue.created_at, queue.updated_at],
        )?;
        Ok(())
    }

    /// Update a queue
    pub fn update_queue(&self, queue: &Queue) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let rows = conn.execute(
            "UPDATE queues SET name = ?, status = ?, max_parallel = ?, updated_at = ? WHERE id = ?",
            params![queue.name, queue.status.to_string(), queue.max_parallel, queue.updated_at, queue.id],
        )?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Queue not found: {}", queue.id)));
        }
        Ok(())
    }

    /// Delete a queue
    pub fn delete_queue(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let rows = conn.execute("DELETE FROM queues WHERE id = ?", [id])?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Queue not found: {}", id)));
        }
        Ok(())
    }

    // ==================== Task Operations ====================

    /// Get tasks for a queue
    pub fn get_tasks(&self, queue_id: &str) -> AppResult<Vec<Task>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, queue_id, type, config, status, progress, bytes_processed, total_bytes, error, created_at, started_at, completed_at 
             FROM tasks WHERE queue_id = ? ORDER BY created_at ASC"
        )?;
        
        let tasks = stmt.query_map([queue_id], |row| {
            let config_json: String = row.get(3)?;
            Ok(Task {
                id: row.get(0)?,
                queue_id: row.get(1)?,
                task_type: row.get::<_, String>(2)?.parse().unwrap_or(TaskType::Copy),
                config: serde_json::from_str(&config_json).unwrap_or_default(),
                status: row.get::<_, String>(4)?.parse().unwrap_or(TaskStatus::Pending),
                progress: row.get(5)?,
                bytes_processed: row.get(6)?,
                total_bytes: row.get(7)?,
                error: row.get(8)?,
                created_at: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(tasks)
    }

    /// Get a task by ID
    pub fn get_task(&self, id: &str) -> AppResult<Task> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, queue_id, type, config, status, progress, bytes_processed, total_bytes, error, created_at, started_at, completed_at 
             FROM tasks WHERE id = ?"
        )?;
        
        stmt.query_row([id], |row| {
            let config_json: String = row.get(3)?;
            Ok(Task {
                id: row.get(0)?,
                queue_id: row.get(1)?,
                task_type: row.get::<_, String>(2)?.parse().unwrap_or(TaskType::Copy),
                config: serde_json::from_str(&config_json).unwrap_or_default(),
                status: row.get::<_, String>(4)?.parse().unwrap_or(TaskStatus::Pending),
                progress: row.get(5)?,
                bytes_processed: row.get(6)?,
                total_bytes: row.get(7)?,
                error: row.get(8)?,
                created_at: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        }).map_err(|_| AppError::NotFound(format!("Task not found: {}", id)))
    }

    /// Create a new task
    pub fn create_task(&self, task: &Task) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let config_json = serde_json::to_string(&task.config)?;
        
        conn.execute(
            "INSERT INTO tasks (id, queue_id, type, config, status, progress, bytes_processed, total_bytes, error, created_at, started_at, completed_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                task.id, task.queue_id, task.task_type.to_string(), config_json, task.status.to_string(),
                task.progress, task.bytes_processed, task.total_bytes, task.error,
                task.created_at, task.started_at, task.completed_at
            ],
        )?;
        Ok(())
    }

    /// Update a task
    pub fn update_task(&self, task: &Task) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let config_json = serde_json::to_string(&task.config)?;
        
        let rows = conn.execute(
            "UPDATE tasks SET type = ?, config = ?, status = ?, progress = ?, bytes_processed = ?, total_bytes = ?, error = ?, started_at = ?, completed_at = ? WHERE id = ?",
            params![
                task.task_type.to_string(), config_json, task.status.to_string(),
                task.progress, task.bytes_processed, task.total_bytes, task.error,
                task.started_at, task.completed_at, task.id
            ],
        )?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Task not found: {}", task.id)));
        }
        Ok(())
    }

    /// Delete a task
    pub fn delete_task(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let rows = conn.execute("DELETE FROM tasks WHERE id = ?", [id])?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Task not found: {}", id)));
        }
        Ok(())
    }

    // ==================== Workflow Operations ====================

    /// Get all workflows
    pub fn get_workflows(&self) -> AppResult<Vec<Workflow>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, type, status, trigger_type, trigger_path, trigger_pattern, 
                    trigger_recursive, trigger_max_depth, trigger_process_existing, trigger_newer_than,
                    execution_mode, execution_max_parallel, output_directory, output_name_template,
                    recovery_interrupted, recovery_check_missed, watch_ignore_temp, watch_temp_patterns,
                    watch_ignore_hidden, watch_min_file_size, created_at, updated_at
             FROM workflows ORDER BY created_at DESC"
        )?;
        
        let mut workflows = Vec::new();
        let mut rows = stmt.query([])?;
        
        while let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let temp_patterns_json: String = row.get(18)?;
            
            workflows.push(Workflow {
                id: id.clone(),
                name: row.get(1)?,
                workflow_type: row.get::<_, String>(2)?.parse().unwrap_or(WorkflowType::FilePipeline),
                status: row.get::<_, String>(3)?.parse().unwrap_or(WorkflowStatus::Idle),
                trigger: WorkflowTrigger {
                    trigger_type: row.get::<_, String>(4)?.parse().unwrap_or(TriggerType::Manual),
                    path: row.get(5)?,
                    file_pattern: row.get(6)?,
                    recursive: row.get::<_, i32>(7)? != 0,
                    max_depth: row.get(8)?,
                    process_existing_on_start: row.get::<_, i32>(9)? != 0,
                    existing_files_newer_than: row.get(10)?,
                },
                execution: WorkflowExecution {
                    mode: row.get::<_, String>(11)?.parse().unwrap_or(ExecutionMode::Sequential),
                    max_parallel: row.get(12)?,
                },
                output: WorkflowOutput {
                    directory: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
                    name_template: row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "{filename}.{ext}".to_string()),
                },
                tasks: self.get_workflow_tasks_internal(&conn, &id)?,
                recovery: WorkflowRecovery {
                    interrupted_files: row.get::<_, String>(15)?.parse().unwrap_or(RecoveryStrategy::Ask),
                    check_missed_files: row.get::<_, i32>(16)? != 0,
                },
                watch_options: Some(WatchOptions {
                    ignore_temp_files: row.get::<_, i32>(17)? != 0,
                    temp_patterns: serde_json::from_str(&temp_patterns_json).unwrap_or_default(),
                    ignore_hidden_files: row.get::<_, i32>(19)? != 0,
                    min_file_size: row.get(20)?,
                }),
                created_at: row.get(21)?,
                updated_at: row.get(22)?,
            });
        }
        
        Ok(workflows)
    }

    /// Get workflow tasks (internal helper)
    fn get_workflow_tasks_internal(&self, conn: &Connection, workflow_id: &str) -> AppResult<Vec<WorkflowTaskDefinition>> {
        let mut stmt = conn.prepare(
            "SELECT id, task_type, config, on_error, created_at 
             FROM workflow_tasks WHERE workflow_id = ? ORDER BY position ASC"
        )?;
        
        let tasks = stmt.query_map([workflow_id], |row| {
            let config_json: String = row.get(2)?;
            Ok(WorkflowTaskDefinition {
                id: row.get(0)?,
                task_type: row.get::<_, String>(1)?.parse().unwrap_or(TaskType::Copy),
                config: serde_json::from_str(&config_json).unwrap_or_default(),
                on_error: row.get::<_, String>(3)?.parse().unwrap_or(ErrorStrategy::FailFile),
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(tasks)
    }

    /// Get a workflow by ID
    pub fn get_workflow(&self, id: &str) -> AppResult<Workflow> {
        let workflows = self.get_workflows()?;
        workflows.into_iter()
            .find(|w| w.id == id)
            .ok_or_else(|| AppError::NotFound(format!("Workflow not found: {}", id)))
    }

    /// Create a new workflow
    pub fn create_workflow(&self, workflow: &Workflow) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        
        let temp_patterns = serde_json::to_string(
            &workflow.watch_options.as_ref().map(|w| &w.temp_patterns).unwrap_or(&vec![])
        )?;
        
        conn.execute(
            "INSERT INTO workflows (id, name, type, status, trigger_type, trigger_path, trigger_pattern,
                trigger_recursive, trigger_max_depth, trigger_process_existing, trigger_newer_than,
                execution_mode, execution_max_parallel, output_directory, output_name_template,
                recovery_interrupted, recovery_check_missed, watch_ignore_temp, watch_temp_patterns,
                watch_ignore_hidden, watch_min_file_size, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                workflow.id, workflow.name, workflow.workflow_type.to_string(), workflow.status.to_string(),
                workflow.trigger.trigger_type.to_string(), workflow.trigger.path, workflow.trigger.file_pattern,
                workflow.trigger.recursive as i32, workflow.trigger.max_depth, workflow.trigger.process_existing_on_start as i32,
                workflow.trigger.existing_files_newer_than, workflow.execution.mode.to_string(), workflow.execution.max_parallel,
                workflow.output.directory, workflow.output.name_template, workflow.recovery.interrupted_files.to_string(),
                workflow.recovery.check_missed_files as i32,
                workflow.watch_options.as_ref().map(|w| w.ignore_temp_files).unwrap_or(true) as i32,
                temp_patterns,
                workflow.watch_options.as_ref().map(|w| w.ignore_hidden_files).unwrap_or(true) as i32,
                workflow.watch_options.as_ref().and_then(|w| w.min_file_size),
                workflow.created_at, workflow.updated_at
            ],
        )?;
        
        // Insert workflow tasks
        for (position, task) in workflow.tasks.iter().enumerate() {
            let config_json = serde_json::to_string(&task.config)?;
            conn.execute(
                "INSERT INTO workflow_tasks (id, workflow_id, position, task_type, config, on_error, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    task.id, workflow.id, position as i32, task.task_type.to_string(),
                    config_json, task.on_error.to_string(), workflow.created_at
                ],
            )?;
        }
        
        Ok(())
    }

    /// Update a workflow
    pub fn update_workflow(&self, workflow: &Workflow) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        
        let temp_patterns = serde_json::to_string(
            &workflow.watch_options.as_ref().map(|w| &w.temp_patterns).unwrap_or(&vec![])
        )?;
        
        let rows = conn.execute(
            "UPDATE workflows SET name = ?, type = ?, status = ?, trigger_type = ?, trigger_path = ?, 
                trigger_pattern = ?, trigger_recursive = ?, trigger_max_depth = ?, trigger_process_existing = ?,
                trigger_newer_than = ?, execution_mode = ?, execution_max_parallel = ?, output_directory = ?,
                output_name_template = ?, recovery_interrupted = ?, recovery_check_missed = ?, watch_ignore_temp = ?,
                watch_temp_patterns = ?, watch_ignore_hidden = ?, watch_min_file_size = ?, updated_at = ?
             WHERE id = ?",
            params![
                workflow.name, workflow.workflow_type.to_string(), workflow.status.to_string(),
                workflow.trigger.trigger_type.to_string(), workflow.trigger.path, workflow.trigger.file_pattern,
                workflow.trigger.recursive as i32, workflow.trigger.max_depth, workflow.trigger.process_existing_on_start as i32,
                workflow.trigger.existing_files_newer_than, workflow.execution.mode.to_string(), workflow.execution.max_parallel,
                workflow.output.directory, workflow.output.name_template, workflow.recovery.interrupted_files.to_string(),
                workflow.recovery.check_missed_files as i32,
                workflow.watch_options.as_ref().map(|w| w.ignore_temp_files).unwrap_or(true) as i32,
                temp_patterns,
                workflow.watch_options.as_ref().map(|w| w.ignore_hidden_files).unwrap_or(true) as i32,
                workflow.watch_options.as_ref().and_then(|w| w.min_file_size),
                workflow.updated_at, workflow.id
            ],
        )?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Workflow not found: {}", workflow.id)));
        }
        
        // Update workflow tasks: delete old ones and insert new
        conn.execute("DELETE FROM workflow_tasks WHERE workflow_id = ?", [&workflow.id])?;
        
        for (position, task) in workflow.tasks.iter().enumerate() {
            let config_json = serde_json::to_string(&task.config)?;
            conn.execute(
                "INSERT INTO workflow_tasks (id, workflow_id, position, task_type, config, on_error, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                params![
                    task.id, workflow.id, position as i32, task.task_type.to_string(),
                    config_json, task.on_error.to_string(), workflow.updated_at
                ],
            )?;
        }
        
        Ok(())
    }

    /// Delete a workflow
    pub fn delete_workflow(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let rows = conn.execute("DELETE FROM workflows WHERE id = ?", [id])?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Workflow not found: {}", id)));
        }
        Ok(())
    }

    // ==================== Settings Operations ====================

    /// Get application settings
    pub fn get_settings(&self) -> AppResult<AppSettings> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT pause_all_on_startup, theme, default_user_context_id, default_header_preset_ids,
                    default_timeout, default_retry_attempts, default_max_concurrent
             FROM app_settings WHERE id = 1"
        )?;
        
        stmt.query_row([], |row| {
            let preset_ids_json: String = row.get(3)?;
            Ok(AppSettings {
                pause_all_on_startup: row.get::<_, i32>(0)? != 0,
                theme: row.get::<_, String>(1)?.parse().unwrap_or(Theme::System),
                download_defaults: DownloadDefaults {
                    default_user_context_id: row.get(2)?,
                    default_header_preset_ids: serde_json::from_str(&preset_ids_json).unwrap_or_default(),
                    default_timeout: row.get(4)?,
                    default_retry_attempts: row.get(5)?,
                    default_max_concurrent: row.get(6)?,
                },
            })
        }).map_err(|e| AppError::Database(e.to_string()))
    }

    /// Update application settings
    pub fn update_settings(&self, settings: &AppSettings) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let preset_ids_json = serde_json::to_string(&settings.download_defaults.default_header_preset_ids)?;
        
        conn.execute(
            "UPDATE app_settings SET pause_all_on_startup = ?, theme = ?, default_user_context_id = ?,
                default_header_preset_ids = ?, default_timeout = ?, default_retry_attempts = ?,
                default_max_concurrent = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = 1",
            params![
                settings.pause_all_on_startup as i32, settings.theme.to_string(),
                settings.download_defaults.default_user_context_id, preset_ids_json,
                settings.download_defaults.default_timeout, settings.download_defaults.default_retry_attempts,
                settings.download_defaults.default_max_concurrent
            ],
        )?;
        Ok(())
    }

    // ==================== User Context Operations ====================

    /// Get all user contexts (from database only - built-ins loaded separately)
    pub fn get_user_contexts(&self) -> AppResult<Vec<UserContext>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, headers FROM user_contexts ORDER BY name ASC"
        )?;
        
        let contexts = stmt.query_map([], |row| {
            let headers_json: String = row.get(3)?;
            Ok(UserContext {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_built_in: false,
                headers: serde_json::from_str(&headers_json).unwrap_or_default(),
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(contexts)
    }

    /// Create a user context
    pub fn create_user_context(&self, context: &UserContext) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let headers_json = serde_json::to_string(&context.headers)?;
        let now = chrono::Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT INTO user_contexts (id, name, description, headers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            params![context.id, context.name, context.description, headers_json, now, now],
        )?;
        Ok(())
    }

    /// Update a user context
    pub fn update_user_context(&self, context: &UserContext) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let headers_json = serde_json::to_string(&context.headers)?;
        let now = chrono::Utc::now().to_rfc3339();
        
        let rows = conn.execute(
            "UPDATE user_contexts SET name = ?, description = ?, headers = ?, updated_at = ? WHERE id = ?",
            params![context.name, context.description, headers_json, now, context.id],
        )?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("User context not found: {}", context.id)));
        }
        Ok(())
    }

    /// Delete a user context
    pub fn delete_user_context(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let rows = conn.execute("DELETE FROM user_contexts WHERE id = ?", [id])?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("User context not found: {}", id)));
        }
        Ok(())
    }

    // ==================== Header Preset Operations ====================

    /// Get all header presets
    pub fn get_header_presets(&self) -> AppResult<Vec<HeaderPreset>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, headers, created_at, updated_at FROM header_presets ORDER BY name ASC"
        )?;
        
        let presets = stmt.query_map([], |row| {
            let headers_json: String = row.get(3)?;
            Ok(HeaderPreset {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                headers: serde_json::from_str(&headers_json).unwrap_or_default(),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(presets)
    }

    /// Create a header preset
    pub fn create_header_preset(&self, preset: &HeaderPreset) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let headers_json = serde_json::to_string(&preset.headers)?;
        
        conn.execute(
            "INSERT INTO header_presets (id, name, description, headers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            params![preset.id, preset.name, preset.description, headers_json, preset.created_at, preset.updated_at],
        )?;
        Ok(())
    }

    /// Update a header preset
    pub fn update_header_preset(&self, preset: &HeaderPreset) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let headers_json = serde_json::to_string(&preset.headers)?;
        
        let rows = conn.execute(
            "UPDATE header_presets SET name = ?, description = ?, headers = ?, updated_at = ? WHERE id = ?",
            params![preset.name, preset.description, headers_json, preset.updated_at, preset.id],
        )?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Header preset not found: {}", preset.id)));
        }
        Ok(())
    }

    /// Delete a header preset
    pub fn delete_header_preset(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let rows = conn.execute("DELETE FROM header_presets WHERE id = ?", [id])?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Header preset not found: {}", id)));
        }
        Ok(())
    }

    // ==================== Task Template Operations ====================

    /// Get all task templates
    pub fn get_task_templates(&self) -> AppResult<Vec<TaskTemplate>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, description, icon, base_task, config, locked_fields FROM task_templates ORDER BY name ASC"
        )?;
        
        let templates = stmt.query_map([], |row| {
            let config_json: String = row.get(5)?;
            let locked_json: String = row.get(6)?;
            Ok(TaskTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                icon: row.get(3)?,
                base_task: row.get::<_, String>(4)?.parse().unwrap_or(TaskType::Copy),
                config: serde_json::from_str(&config_json).unwrap_or_default(),
                locked_fields: serde_json::from_str(&locked_json).unwrap_or_default(),
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(templates)
    }

    /// Create a task template
    pub fn create_task_template(&self, template: &TaskTemplate) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let config_json = serde_json::to_string(&template.config)?;
        let locked_json = serde_json::to_string(&template.locked_fields)?;
        let now = chrono::Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT INTO task_templates (id, name, description, icon, base_task, config, locked_fields, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![
                template.id, template.name, template.description, template.icon,
                template.base_task.to_string(), config_json, locked_json, now, now
            ],
        )?;
        Ok(())
    }

    /// Delete a task template
    pub fn delete_task_template(&self, id: &str) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let rows = conn.execute("DELETE FROM task_templates WHERE id = ?", [id])?;
        
        if rows == 0 {
            return Err(AppError::NotFound(format!("Task template not found: {}", id)));
        }
        Ok(())
    }

    // ==================== Workflow File Operations ====================

    /// Get workflow files
    pub fn get_workflow_files(&self, workflow_id: &str) -> AppResult<Vec<WorkflowFile>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, workflow_id, source_path, status, added_at, started_at, completed_at 
             FROM workflow_files WHERE workflow_id = ? ORDER BY added_at DESC"
        )?;
        
        let files = stmt.query_map([workflow_id], |row| {
            Ok(WorkflowFile {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                source_path: row.get(2)?,
                status: row.get::<_, String>(3)?.parse().unwrap_or(WorkflowFileStatus::Pending),
                task_statuses: vec![], // Loaded separately if needed
                added_at: row.get(4)?,
                started_at: row.get(5)?,
                completed_at: row.get(6)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(files)
    }

    /// Add a file to workflow processing
    pub fn add_workflow_file(&self, file: &WorkflowFile) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        
        conn.execute(
            "INSERT INTO workflow_files (id, workflow_id, source_path, status, added_at) VALUES (?, ?, ?, ?, ?)",
            params![file.id, file.workflow_id, file.source_path, file.status.to_string(), file.added_at],
        )?;
        Ok(())
    }

    /// Check if file was already processed
    pub fn is_file_processed(&self, workflow_id: &str, file_path: &str) -> AppResult<bool> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT 1 FROM workflow_processed_files WHERE workflow_id = ? AND file_path = ?"
        )?;
        
        Ok(stmt.exists([workflow_id, file_path])?)
    }

    /// Mark file as processed
    pub fn mark_file_processed(&self, workflow_id: &str, file_path: &str, file_hash: Option<&str>) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT OR REPLACE INTO workflow_processed_files (workflow_id, file_path, file_hash, processed_at) VALUES (?, ?, ?, ?)",
            params![workflow_id, file_path, file_hash, now],
        )?;
        Ok(())
    }

    // ==================== Dependency Operations ====================

    /// Update dependency status
    pub fn update_dependency(&self, dep: &Dependency) -> AppResult<()> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let now = chrono::Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT OR REPLACE INTO dependencies (name, binary_name, available, version, last_checked) VALUES (?, ?, ?, ?, ?)",
            params![dep.name, dep.binary, dep.available as i32, dep.version, now],
        )?;
        Ok(())
    }

    /// Get all dependency statuses
    pub fn get_dependencies(&self) -> AppResult<Vec<Dependency>> {
        let conn = self.conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT name, binary_name, available, version FROM dependencies"
        )?;
        
        let deps = stmt.query_map([], |row| {
            Ok(Dependency {
                name: row.get(0)?,
                binary: row.get(1)?,
                check_command: String::new(), // Not stored
                required: false, // Not stored
                used_by: vec![], // Not stored
                available: row.get::<_, i32>(2)? != 0,
                version: row.get(3)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        
        Ok(deps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_creation() {
        let db = Database::in_memory().unwrap();
        let settings = db.get_settings().unwrap();
        assert!(settings.pause_all_on_startup);
    }

    #[test]
    fn test_queue_crud() {
        let db = Database::in_memory().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        
        let queue = Queue {
            id: "test-queue".to_string(),
            name: "Test Queue".to_string(),
            status: QueueStatus::Idle,
            max_parallel: 2,
            created_at: now.clone(),
            updated_at: now.clone(),
        };
        
        db.create_queue(&queue).unwrap();
        
        let queues = db.get_queues().unwrap();
        assert_eq!(queues.len(), 1);
        assert_eq!(queues[0].name, "Test Queue");
        
        db.delete_queue("test-queue").unwrap();
        let queues = db.get_queues().unwrap();
        assert_eq!(queues.len(), 0);
    }
}
