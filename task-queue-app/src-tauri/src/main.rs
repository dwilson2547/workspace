#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod db;
mod queue;
mod tasks;

use commands::AppState;
use queue::QueueManager;
use std::sync::Arc;
use tauri::Manager;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "task_queue_app=debug,tauri=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Task Queue Manager");

    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Get the app data directory for the database
            let app_dir = app
                .path_resolver()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");

            let db_path = app_dir.join("task_queues.db");
            info!("Database path: {:?}", db_path);

            // Initialize database and queue manager asynchronously
            tauri::async_runtime::spawn(async move {
                match db::init_database(&db_path).await {
                    Ok(pool) => {
                        let queue_manager = Arc::new(QueueManager::new(pool.clone(), app_handle.clone()));

                        // Store state
                        app_handle.manage(AppState {
                            pool,
                            queue_manager,
                        });

                        info!("Application state initialized");
                    }
                    Err(e) => {
                        error!("Failed to initialize database: {}", e);
                    }
                }
            });

            // Create main window in a separate thread to avoid blocking
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                info!("Creating main window in separate thread");
                match tauri::WindowBuilder::new(
                    &handle,
                    "main",
                    tauri::WindowUrl::App("index.html".into())
                )
                .title("Task Queue Manager")
                .inner_size(1200.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .resizable(true)
                .build()
                {
                    Ok(window) => {
                        info!("Main window created successfully");
                        // Ensure window is visible
                        let _ = window.show();
                    }
                    Err(e) => {
                        error!("Failed to create main window: {}", e);
                    }
                }
            });

            info!("Application setup complete");
            Ok(())
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::Focused(focused) => {
                if *focused {
                    info!("Window regained focus");
                    // Don't emit events here - let the frontend handle focus recovery
                    // to avoid race conditions with ongoing FFmpeg processes
                }
            }
            tauri::WindowEvent::ThemeChanged(_) => {
                info!("Theme changed");
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            // Queue commands
            commands::create_queue,
            commands::get_queues,
            commands::get_queue,
            commands::resume_queue,
            commands::pause_queue,
            commands::delete_queue,
            commands::rename_queue,
            // Task commands
            commands::add_task,
            commands::get_queue_tasks,
            commands::delete_task,
            commands::reorder_task,
            // History commands
            commands::get_history,
            commands::get_queue_history,
            commands::clear_history,
            commands::get_history_stats,
            // Utility commands
            commands::check_ffmpeg,
            commands::get_available_encoders,
            commands::validate_task_config,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
