use async_trait::async_trait;
use regex::Regex;
use serde_json::Value;
use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tracing::{debug, error, info};

use super::{send_progress, ProgressSender, TaskError, TaskExecutor, TaskResult};
use crate::db::models::{TaskType, TranscodeConfig};

pub struct TranscodeExecutor;

#[async_trait]
impl TaskExecutor for TranscodeExecutor {
    async fn execute(
        &self,
        task_id: &str,
        queue_id: &str,
        config: &Value,
        progress_tx: ProgressSender,
    ) -> Result<TaskResult, TaskError> {
        let config: TranscodeConfig = serde_json::from_value(config.clone())
            .map_err(|e| TaskError::InvalidConfig(e.to_string()))?;

        let input_path = Path::new(&config.input);
        if !input_path.exists() {
            return Err(TaskError::SourceNotFound(config.input.clone()));
        }

        // Create output directory if needed
        let output_path = Path::new(&config.output);
        if let Some(parent) = output_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        info!(
            "Starting transcode: {} -> {} (codec: {}, preset: {})",
            config.input, config.output, config.codec, config.preset
        );

        send_progress(
            &progress_tx,
            task_id,
            queue_id,
            0,
            None,
            Some(config.input.clone()),
            Some("Analyzing input file...".to_string()),
        );

        // Get input duration using ffprobe
        let duration = get_video_duration(&config.input).await;
        let total_frames = duration.map(|d| (d * 30.0) as u64); // Estimate at 30fps

        send_progress(
            &progress_tx,
            task_id,
            queue_id,
            0,
            total_frames,
            Some(config.input.clone()),
            Some("Starting transcode...".to_string()),
        );

        // Build ffmpeg command
        let mut cmd = Command::new("ffmpeg");

        // Input
        cmd.arg("-i").arg(&config.input);

        // Enable graceful shutdown on SIGTERM/SIGINT
        cmd.arg("-nostdin");

        // Video codec
        cmd.arg("-c:v").arg(&config.codec);

        // Preset
        cmd.arg("-preset").arg(&config.preset);

        // CRF (quality)
        if let Some(crf) = config.crf {
            cmd.arg("-crf").arg(crf.to_string());
        }

        // Resolution
        if let Some(ref resolution) = config.resolution {
            cmd.arg("-s").arg(resolution);
        }

        // Audio codec
        if let Some(ref audio_codec) = config.audio_codec {
            cmd.arg("-c:a").arg(audio_codec);
        }

        // Extra arguments
        if let Some(ref extra) = config.extra_args {
            for arg in extra {
                cmd.arg(arg);
            }
        }

        // Progress output
        cmd.arg("-progress").arg("pipe:2");
        cmd.arg("-y"); // Overwrite output

        // Output
        cmd.arg(&config.output);

        // Capture stderr for progress
        cmd.stderr(Stdio::piped());
        cmd.stdout(Stdio::null());

        debug!("FFmpeg command: {:?}", cmd);

        let mut child = cmd.spawn().map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                TaskError::ProcessError(
                    "FFmpeg not found. Please install FFmpeg and ensure it's in your PATH."
                        .to_string(),
                )
            } else {
                TaskError::ProcessError(format!("Failed to start FFmpeg: {}", e))
            }
        })?;

        // Store the process ID for cleanup
        let child_id = child.id();
        info!("Started FFmpeg process with PID: {:?}", child_id);

        // No guard needed - we'll handle cleanup explicitly in error cases
        // This prevents race conditions with multiple concurrent FFmpeg processes

        let stderr = child.stderr.take().unwrap();
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        let frame_regex = Regex::new(r"frame=\s*(\d+)").unwrap();
        let _fps_regex = Regex::new(r"fps=\s*([\d.]+)").unwrap();
        let time_regex = Regex::new(r"out_time_ms=\s*(\d+)").unwrap();
        let speed_regex = Regex::new(r"speed=\s*([\d.]+)x").unwrap();

        let mut frames_processed = 0u64;
        let mut last_update = std::time::Instant::now();

        // Parse FFmpeg progress output
        while let Ok(Some(line)) = lines.next_line().await {
            // Parse frame count
            if let Some(captures) = frame_regex.captures(&line) {
                if let Ok(frame) = captures[1].parse::<u64>() {
                    frames_processed = frame;
                }
            }

            // Parse time
            if let Some(captures) = time_regex.captures(&line) {
                if let Ok(time_us) = captures[1].parse::<u64>() {
                    let time_secs = time_us as f64 / 1_000_000.0;

                    // Calculate percentage if we know duration
                    let _percentage = duration.map(|d| {
                        if d > 0.0 {
                            ((time_secs / d) * 100.0) as f32
                        } else {
                            0.0
                        }
                    });

                    // Throttle updates - reduce frequency to ease database load
                    if last_update.elapsed().as_millis() > 1000 {
                        let mut msg = format!("Transcoding... {:.1}s", time_secs);

                        // Add speed info if available
                        if let Some(captures) = speed_regex.captures(&line) {
                            if let Ok(speed) = captures[1].parse::<f64>() {
                                msg = format!("{} ({:.2}x speed)", msg, speed);
                            }
                        }

                        send_progress(
                            &progress_tx,
                            task_id,
                            queue_id,
                            frames_processed,
                            total_frames,
                            Some(config.input.clone()),
                            Some(msg),
                        );

                        last_update = std::time::Instant::now();
                    }
                }
            }

            // Check for progress=end
            if line.contains("progress=end") {
                break;
            }
        }

        // Wait for process to complete with timeout
        let status = tokio::select! {
            result = child.wait() => {
                match result {
                    Ok(status) => {
                        // Verify process is truly dead
                        info!("FFmpeg process exited with status: {:?}", status);
                        
                        // Extra safety: give OS time to fully clean up
                        tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
                        status
                    },
                    Err(e) => {
                        error!("Error waiting for FFmpeg process: {}", e);
                        
                        // Try to kill the process on error
                        if let Err(kill_err) = child.kill().await {
                            error!("Failed to kill FFmpeg after wait error: {}", kill_err);
                        }
                        
                        // Wait for process to die
                        for _ in 0..10 {
                            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                            if let Ok(Some(_)) = child.try_wait() {
                                break;
                            }
                        }
                        
                        return Err(TaskError::from(e));
                    }
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_secs(3600)) => {
                // Timeout after 1 hour - kill the process gracefully
                error!("FFmpeg process timed out, killing PID: {:?}", child_id);
                
                // Try graceful kill first
                if let Err(e) = child.kill().await {
                    error!("Failed to kill FFmpeg process: {}", e);
                }
                
                // Wait for process to actually die
                for attempt in 0..10 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                    
                    // Try to get status - if it returns an error, process is dead
                    match child.try_wait() {
                        Ok(Some(_)) => {
                            info!("FFmpeg process terminated after {} attempts", attempt + 1);
                            break;
                        }
                        Ok(None) => {
                            // Still running, try killing again
                            let _ = child.start_kill();
                        }
                        Err(_) => {
                            // Process is dead
                            break;
                        }
                    }
                }
                
                return Err(TaskError::ProcessError("Transcode timed out after 1 hour".to_string()));
            }
        };

        if status.success() {
            // Get output file size
            let output_size = tokio::fs::metadata(&config.output)
                .await
                .map(|m| m.len())
                .unwrap_or(0);

            send_progress(
                &progress_tx,
                task_id,
                queue_id,
                frames_processed,
                total_frames,
                None,
                Some("Transcode completed".to_string()),
            );

            info!(
                "Transcode completed: {} frames, {} bytes output",
                frames_processed, output_size
            );

            Ok(TaskResult::new(output_size, 1).with_message(format!(
                "Transcoded {} frames to {}",
                frames_processed, config.output
            )))
        } else {
            let code = status.code();
            error!("FFmpeg failed with exit code: {:?}", code);
            Err(TaskError::ProcessFailed(code))
        }
    }

    fn task_type(&self) -> TaskType {
        TaskType::Transcode
    }

    fn validate_config(&self, config: &Value) -> Result<(), String> {
        let config: TranscodeConfig =
            serde_json::from_value(config.clone()).map_err(|e| e.to_string())?;

        if config.input.is_empty() {
            return Err("Input path is required".to_string());
        }

        if config.output.is_empty() {
            return Err("Output path is required".to_string());
        }

        // Validate codec
        let valid_codecs = [
            "libx264",
            "libx265",
            "libvpx",
            "libvpx-vp9",
            "libaom-av1",
            "h264_nvenc",
            "hevc_nvenc",
            "h264_qsv",
            "hevc_qsv",
            "h264_videotoolbox",
            "hevc_videotoolbox",
            "copy",
        ];

        if !valid_codecs.contains(&config.codec.as_str()) {
            return Err(format!(
                "Invalid codec '{}'. Valid options: {}",
                config.codec,
                valid_codecs.join(", ")
            ));
        }

        // Validate preset
        let valid_presets = [
            "ultrafast",
            "superfast",
            "veryfast",
            "faster",
            "fast",
            "medium",
            "slow",
            "slower",
            "veryslow",
        ];

        if !valid_presets.contains(&config.preset.as_str()) {
            return Err(format!(
                "Invalid preset '{}'. Valid options: {}",
                config.preset,
                valid_presets.join(", ")
            ));
        }

        // Validate CRF
        if let Some(crf) = config.crf {
            if crf > 51 {
                return Err("CRF must be between 0 and 51".to_string());
            }
        }

        // Validate resolution format
        if let Some(ref resolution) = config.resolution {
            let res_regex = Regex::new(r"^\d+x\d+$").unwrap();
            if !res_regex.is_match(resolution) {
                return Err("Resolution must be in format WIDTHxHEIGHT (e.g., 1920x1080)".to_string());
            }
        }

        Ok(())
    }
}

/// Get video duration in seconds using ffprobe
async fn get_video_duration(input: &str) -> Option<f64> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            input,
        ])
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.trim().parse().ok()
}

/// Check if FFmpeg is available
pub async fn check_ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Get available hardware encoders
pub async fn get_available_encoders() -> Vec<String> {
    let mut encoders = vec![
        "libx264".to_string(),
        "libx265".to_string(),
        "libvpx-vp9".to_string(),
    ];

    // Check for hardware encoders
    let output = Command::new("ffmpeg")
        .args(["-hide_banner", "-encoders"])
        .output()
        .await;

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);

        // NVIDIA NVENC
        if stdout.contains("h264_nvenc") {
            encoders.push("h264_nvenc".to_string());
        }
        if stdout.contains("hevc_nvenc") {
            encoders.push("hevc_nvenc".to_string());
        }

        // Intel QuickSync
        if stdout.contains("h264_qsv") {
            encoders.push("h264_qsv".to_string());
        }
        if stdout.contains("hevc_qsv") {
            encoders.push("hevc_qsv".to_string());
        }

        // Apple VideoToolbox
        if stdout.contains("h264_videotoolbox") {
            encoders.push("h264_videotoolbox".to_string());
        }
        if stdout.contains("hevc_videotoolbox") {
            encoders.push("hevc_videotoolbox".to_string());
        }

        // AV1
        if stdout.contains("libaom-av1") {
            encoders.push("libaom-av1".to_string());
        }
    }

    encoders
}
