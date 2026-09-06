// Types matching the Rust backend models

export type QueueStatus = 'paused' | 'running';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskType = 'copy' | 'zip' | 'tar' | 'transcode';

export interface QueueInfo {
  id: string;
  name: string;
  status: QueueStatus;
  task_count: number;
  pending_count: number;
  current_task: TaskInfo | null;
  created_at: string;
  updated_at: string;
}

export interface TaskInfo {
  id: string;
  queue_id: string;
  task_type: TaskType;
  config: TaskConfig;
  status: TaskStatus;
  position: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface TaskHistoryInfo {
  id: number;
  original_task_id: string;
  queue_id: string;
  queue_name: string;
  task_type: TaskType;
  config: TaskConfig;
  status: TaskStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  bytes_processed: number | null;
  duration_ms: number | null;
}

export interface HistoryStats {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_bytes_processed: number;
}

// Task configurations

export type TaskConfig = CopyConfig | ZipConfig | TarConfig | TranscodeConfig;

export interface CopyConfig {
  source: string;
  destination: string;
}

export interface ZipConfig {
  inputs: string[];
  output: string;
}

export interface TarConfig {
  inputs: string[];
  output: string;
  gzip: boolean;
}

export interface TranscodeConfig {
  input: string;
  output: string;
  codec: string;
  preset: string;
  crf?: number;
  resolution?: string;
  audio_codec?: string;
  extra_args?: string[];
}

// Event payloads

export interface TaskProgress {
  task_id: string;
  queue_id: string;
  bytes_processed: number;
  total_bytes: number | null;
  percentage: number | null;
  current_file: string | null;
  message: string | null;
}

export interface TaskCompleted {
  task_id: string;
  queue_id: string;
  status: TaskStatus;
  error_message: string | null;
  bytes_processed: number;
  duration_ms: number;
}

export interface QueueStatusChanged {
  queue_id: string;
  status: QueueStatus;
}

// Preset options for transcode

export const VIDEO_CODECS = [
  { value: 'libx264', label: 'H.264 (libx264)' },
  { value: 'libx265', label: 'H.265/HEVC (libx265)' },
  { value: 'libvpx-vp9', label: 'VP9 (libvpx-vp9)' },
  { value: 'libaom-av1', label: 'AV1 (libaom-av1)' },
  { value: 'h264_nvenc', label: 'H.264 NVIDIA (nvenc)' },
  { value: 'hevc_nvenc', label: 'HEVC NVIDIA (nvenc)' },
  { value: 'h264_qsv', label: 'H.264 Intel QuickSync' },
  { value: 'hevc_qsv', label: 'HEVC Intel QuickSync' },
  { value: 'h264_videotoolbox', label: 'H.264 Apple VideoToolbox' },
  { value: 'hevc_videotoolbox', label: 'HEVC Apple VideoToolbox' },
  { value: 'copy', label: 'Copy (no re-encode)' },
] as const;

export const PRESETS = [
  { value: 'ultrafast', label: 'Ultra Fast (lowest quality)' },
  { value: 'superfast', label: 'Super Fast' },
  { value: 'veryfast', label: 'Very Fast' },
  { value: 'faster', label: 'Faster' },
  { value: 'fast', label: 'Fast' },
  { value: 'medium', label: 'Medium (default)' },
  { value: 'slow', label: 'Slow' },
  { value: 'slower', label: 'Slower' },
  { value: 'veryslow', label: 'Very Slow (highest quality)' },
] as const;

export const COMMON_RESOLUTIONS = [
  { value: '3840x2160', label: '4K (3840x2160)' },
  { value: '2560x1440', label: '1440p (2560x1440)' },
  { value: '1920x1080', label: '1080p (1920x1080)' },
  { value: '1280x720', label: '720p (1280x720)' },
  { value: '854x480', label: '480p (854x480)' },
  { value: '640x360', label: '360p (640x360)' },
] as const;

export const AUDIO_CODECS = [
  { value: 'aac', label: 'AAC' },
  { value: 'libmp3lame', label: 'MP3' },
  { value: 'libopus', label: 'Opus' },
  { value: 'libvorbis', label: 'Vorbis' },
  { value: 'flac', label: 'FLAC (lossless)' },
  { value: 'copy', label: 'Copy (no re-encode)' },
] as const;
