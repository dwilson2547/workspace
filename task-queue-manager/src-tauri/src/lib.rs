//! Task Queue Manager - Tauri Backend
//! 
//! This module provides the Rust backend for the Task Queue Manager application.
//! It handles task execution, file watching, database operations, and IPC with the frontend.

use tauri::Manager;

mod commands;
mod database;
mod models;
mod error;

pub use error::{AppError, AppResult};

/// Run the Tauri application
/// 
/// This function sets up the Tauri application with all necessary plugins,
/// commands, and event handlers. It implements the WebView2 stability workaround
/// for Windows by spawning window creation on a separate thread.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize database
            let app_handle = app.handle().clone();
            let db_path = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir")
                .join("task_queue.db");
            
            // Ensure directory exists
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            
            // Initialize database
            database::init(&db_path).expect("Failed to initialize database");
            
            // Store database path in app state
            app.manage(database::DbPath(db_path));
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Queue commands
            commands::get_queues,
            commands::create_queue,
            commands::update_queue,
            commands::delete_queue,
            // Task commands
            commands::get_tasks,
            commands::create_task,
            // Workflow commands
            commands::get_workflows,
            commands::create_workflow,
            commands::update_workflow,
            commands::delete_workflow,
            // Settings commands
            commands::get_settings,
            commands::update_settings,
            // Preset commands
            commands::get_user_contexts,
            commands::get_header_presets,
            // Dependency commands
            commands::check_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
