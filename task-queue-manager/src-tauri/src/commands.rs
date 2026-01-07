//! Tauri Commands
//! 
//! This module contains all IPC commands that the frontend can invoke.

use crate::database;
use crate::error::AppError;
use crate::models::*;

// =============================================================================
// Queue Commands
// =============================================================================

#[tauri::command]
pub async fn get_queues() -> Result<Vec<Queue>, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.get_queues().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_queue(queue: Queue) -> Result<Queue, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.create_queue(&queue).map_err(|e| e.to_string())?;
    Ok(queue)
}

#[tauri::command]
pub async fn update_queue(queue: Queue) -> Result<Queue, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.update_queue(&queue).map_err(|e| e.to_string())?;
    Ok(queue)
}

#[tauri::command]
pub async fn delete_queue(id: String) -> Result<(), String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.delete_queue(&id).map_err(|e| e.to_string())
}

// =============================================================================
// Task Commands
// =============================================================================

#[tauri::command]
pub async fn get_tasks(queue_id: String) -> Result<Vec<Task>, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.get_tasks(&queue_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_task(task: Task) -> Result<Task, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.create_task(&task).map_err(|e| e.to_string())?;
    Ok(task)
}

// =============================================================================
// Workflow Commands
// =============================================================================

#[tauri::command]
pub async fn get_workflows() -> Result<Vec<Workflow>, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.get_workflows().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_workflow(workflow: Workflow) -> Result<Workflow, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.create_workflow(&workflow).map_err(|e| e.to_string())?;
    Ok(workflow)
}

#[tauri::command]
pub async fn update_workflow(workflow: Workflow) -> Result<Workflow, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.update_workflow(&workflow).map_err(|e| e.to_string())?;
    Ok(workflow)
}

#[tauri::command]
pub async fn delete_workflow(id: String) -> Result<(), String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.delete_workflow(&id).map_err(|e| e.to_string())
}

// =============================================================================
// Settings Commands
// =============================================================================

#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_settings(settings: AppSettings) -> Result<AppSettings, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.update_settings(&settings).map_err(|e| e.to_string())?;
    Ok(settings)
}

// =============================================================================
// User Context Commands
// =============================================================================

#[tauri::command]
pub async fn get_user_contexts() -> Result<Vec<UserContext>, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.get_user_contexts().map_err(|e| e.to_string())
}

// =============================================================================
// Header Preset Commands
// =============================================================================

#[tauri::command]
pub async fn get_header_presets() -> Result<Vec<HeaderPreset>, String> {
    let db = database::get().map_err(|e| e.to_string())?;
    db.get_header_presets().map_err(|e| e.to_string())
}

// =============================================================================
// Dependency Commands
// =============================================================================

/// Check system dependencies (ffmpeg, rsync, etc.)
#[tauri::command]
pub async fn check_dependencies() -> Result<Vec<DependencyStatus>, String> {
    use std::process::Command;
    
    let deps = vec![
        ("ffmpeg", "ffmpeg -version", true, vec!["transcode", "audio", "thumbnail"]),
        ("rsync", "rsync --version", false, vec!["rsync"]),
        ("rclone", "rclone version", false, vec!["rclone"]),
        ("pigz", "pigz --version", false, vec!["archive"]),
        ("magick", "magick --version", false, vec!["image", "thumbnail"]),
        ("exiftool", "exiftool -ver", false, vec!["metadata"]),
    ];
    
    let mut results = Vec::new();
    
    for (name, check_cmd, required, used_by) in deps {
        let parts: Vec<&str> = check_cmd.split_whitespace().collect();
        let (binary, args) = parts.split_first().unwrap_or((&"", &[]));
        
        let output = Command::new(binary).args(args.iter()).output();
        
        let (available, version) = match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let version = extract_version(&stdout, name);
                (true, version)
            }
            _ => (false, None),
        };
        
        results.push(DependencyStatus {
            name: name.to_string(),
            binary: binary.to_string(),
            required,
            used_by: used_by.iter().map(|s| s.to_string()).collect(),
            available,
            version,
        });
    }
    
    Ok(results)
}

/// Extract version from command output
fn extract_version(output: &str, name: &str) -> Option<String> {
    let first_line = output.lines().next()?;
    
    match name {
        "ffmpeg" => {
            // ffmpeg version 6.0 Copyright ...
            first_line.split_whitespace().nth(2).map(|s| s.to_string())
        }
        "rsync" => {
            // rsync  version 3.2.7  protocol version 31
            first_line.split_whitespace().nth(2).map(|s| s.to_string())
        }
        "rclone" => {
            // rclone v1.64.0
            first_line.split_whitespace().nth(1).map(|s| s.trim_start_matches('v').to_string())
        }
        "pigz" => {
            // pigz 2.7
            first_line.split_whitespace().nth(1).map(|s| s.to_string())
        }
        "magick" => {
            // Version: ImageMagick 7.1.1-15
            first_line.split_whitespace().nth(2).map(|s| s.to_string())
        }
        "exiftool" => {
            // 12.67
            Some(first_line.trim().to_string())
        }
        _ => None,
    }
}

/// Dependency status for frontend
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyStatus {
    pub name: String,
    pub binary: String,
    pub required: bool,
    pub used_by: Vec<String>,
    pub available: bool,
    pub version: Option<String>,
}
