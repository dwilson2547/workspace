// =============================================================================
// Task Queue Manager - Shared Types
// =============================================================================

// -----------------------------------------------------------------------------
// Task Types
// -----------------------------------------------------------------------------

export type TaskCategory =
  | 'file_operations'
  | 'archives'
  | 'media'
  | 'sync_transfer'
  | 'advanced'
  | 'flow_control'
  | 'custom';

export type TaskType =
  // File Operations
  | 'copy'
  | 'move'
  | 'rename'
  | 'delete'
  | 'extract'
  // Archives
  | 'archive'
  // Media
  | 'transcode'
  | 'audio'
  | 'image'
  | 'thumbnail'
  | 'metadata'
  // Sync & Transfer
  | 'rsync'
  | 'rclone'
  | 'ftp_sftp'
  | 'download'
  // Advanced
  | 'shell_command'
  | 'script'
  | 'http_request'
  // Flow Control
  | 'filter'
  | 'wait'
  | 'branch';

export const TASK_CATEGORIES: Record<TaskCategory, { label: string; tasks: TaskType[] }> = {
  file_operations: {
    label: 'File Operations',
    tasks: ['copy', 'move', 'rename', 'delete', 'extract'],
  },
  archives: {
    label: 'Archives',
    tasks: ['archive'],
  },
  media: {
    label: 'Media',
    tasks: ['transcode', 'audio', 'image', 'thumbnail', 'metadata'],
  },
  sync_transfer: {
    label: 'Sync & Transfer',
    tasks: ['rsync', 'rclone', 'ftp_sftp', 'download'],
  },
  advanced: {
    label: 'Advanced',
    tasks: ['shell_command', 'script', 'http_request'],
  },
  flow_control: {
    label: 'Flow Control',
    tasks: ['filter', 'wait', 'branch'],
  },
  custom: {
    label: 'Custom',
    tasks: [],
  },
};

export const TASK_META: Record<TaskType, { label: string; icon: string; description: string }> = {
  copy: { label: 'Copy', icon: '📋', description: 'Copy files to destination' },
  move: { label: 'Move', icon: '📁', description: 'Move files to destination' },
  rename: { label: 'Rename', icon: '✏️', description: 'Rename files with pattern' },
  delete: { label: 'Delete', icon: '🗑️', description: 'Delete files' },
  extract: { label: 'Extract', icon: '📂', description: 'Extract archive contents' },
  archive: { label: 'Archive', icon: '📦', description: 'Create Zip/Tar archives' },
  transcode: { label: 'Transcode', icon: '🎬', description: 'Convert video files' },
  audio: { label: 'Audio', icon: '🎵', description: 'Process audio files' },
  image: { label: 'Image', icon: '🖼️', description: 'Process images' },
  thumbnail: { label: 'Thumbnail', icon: '🖼️', description: 'Generate thumbnails' },
  metadata: { label: 'Metadata', icon: '🏷️', description: 'Read/write file metadata' },
  rsync: { label: 'Rsync', icon: '🔄', description: 'Sync with rsync' },
  rclone: { label: 'Rclone', icon: '☁️', description: 'Cloud sync with rclone' },
  ftp_sftp: { label: 'FTP/SFTP', icon: '📡', description: 'Transfer via FTP/SFTP' },
  download: { label: 'Download', icon: '⬇️', description: 'Download from URLs' },
  shell_command: { label: 'Shell Command', icon: '💻', description: 'Run shell command' },
  script: { label: 'Script', icon: '📜', description: 'Execute script file' },
  http_request: { label: 'HTTP Request', icon: '🌐', description: 'Make HTTP request' },
  filter: { label: 'Filter', icon: '🔍', description: 'Filter files by condition' },
  wait: { label: 'Wait', icon: '⏱️', description: 'Wait for duration' },
  branch: { label: 'Branch', icon: '🔀', description: 'Conditional branching' },
};

// -----------------------------------------------------------------------------
// Status Types
// -----------------------------------------------------------------------------

export type QueueStatus = 'idle' | 'running' | 'paused';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type WorkflowStatus = 'idle' | 'running' | 'paused';
export type WorkflowFileStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
export type WorkflowTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// -----------------------------------------------------------------------------
// Queue & Task Models
// -----------------------------------------------------------------------------

export interface Queue {
  id: string;
  name: string;
  status: QueueStatus;
  maxParallel: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  queueId: string;
  type: TaskType;
  config: TaskConfig;
  status: TaskStatus;
  progress: number;
  bytesProcessed?: number;
  totalBytes?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// -----------------------------------------------------------------------------
// Task Configurations
// -----------------------------------------------------------------------------

export type TaskConfig =
  | CopyTaskConfig
  | MoveTaskConfig
  | RenameTaskConfig
  | DeleteTaskConfig
  | ExtractTaskConfig
  | ArchiveTaskConfig
  | TranscodeTaskConfig
  | DownloadTaskConfig
  | ShellCommandTaskConfig
  // ... other task configs
  | GenericTaskConfig;

export interface GenericTaskConfig {
  [key: string]: unknown;
}

export interface CopyTaskConfig {
  sourcePath: string;
  destinationPath: string;
  overwrite: boolean;
  preserveTimestamps: boolean;
  passThrough?: 'original' | 'copy';
}

export interface MoveTaskConfig {
  sourcePath: string;
  destinationPath: string;
  overwrite: boolean;
}

export interface RenameTaskConfig {
  sourcePath: string;
  pattern: string;
  replacement: string;
}

export interface DeleteTaskConfig {
  sourcePath: string;
  permanent: boolean;
}

export interface ExtractTaskConfig {
  sourcePath: string;
  destinationPath: string;
  password?: string;
}

export type ArchiveFormat = 'zip' | 'tar';
export type ZipCompression = 'store' | 'deflate' | 'lzma' | 'zstd';
export type TarCompression = 'none' | 'gzip' | 'bzip2' | 'xz' | 'zstd';
export type CpuUsageMode = 'fast' | 'slow';

export interface ArchiveTaskConfig {
  sourcePaths: string[];
  destinationPath: string;
  format: ArchiveFormat;
  zipCompression?: ZipCompression;
  tarCompression?: TarCompression;
  compressionLevel: number;
  cpuUsage: CpuUsageMode;
}

export type VideoCodec =
  | 'libx264'
  | 'libx265'
  | 'libvpx-vp9'
  | 'libaom-av1'
  | 'h264_nvenc'
  | 'hevc_nvenc'
  | 'h264_qsv'
  | 'hevc_qsv'
  | 'h264_videotoolbox'
  | 'hevc_videotoolbox';

export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'flac' | 'copy';

export interface TranscodeTaskConfig {
  sourcePath: string;
  destinationPath: string;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  preset: string;
  crf: number;
  audioBitrate: string;
  cpuUsage?: CpuUsageMode;
}

export type AuthenticationType = 'none' | 'basic' | 'bearer' | 'api_key';

export interface DownloadAuthentication {
  type: AuthenticationType;
  username?: string;
  password?: string;
  token?: string;
  headerName?: string;
  apiKey?: string;
}

export interface DownloadTaskConfig {
  urls: string[];
  urlListFile?: string;
  userContextId?: string;
  headerPresetIds: string[];
  customHeaders: Record<string, string>;
  authentication?: DownloadAuthentication;
  followRedirects: boolean;
  maxRedirects: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  resumePartialDownloads: boolean;
  maxConcurrent: number;
  outputDirectory: string;
  outputTemplate: string;
  overwriteExisting: 'skip' | 'overwrite' | 'rename';
  rateLimit?: number;
}

export interface ShellCommandTaskConfig {
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
}

// -----------------------------------------------------------------------------
// Workflow Models
// -----------------------------------------------------------------------------

export type WorkflowType = 'file_pipeline' | 'task_sequence';
export type TriggerType = 'manual' | 'directory' | 'watch';
export type ExecutionMode = 'sequential' | 'parallel';
export type ErrorHandling = 'continue' | 'fail_file' | 'fail_file_and_pause';
export type RecoveryStrategy = 'retry' | 'skip' | 'ask';

export interface WorkflowTrigger {
  type: TriggerType;
  path?: string;
  filePattern?: string;
  recursive?: boolean;
  maxDepth?: number;
  processExistingOnStart?: boolean;
  existingFilesNewerThan?: string;
}

export interface WorkflowExecution {
  mode: ExecutionMode;
  maxParallel?: number;
}

export interface WorkflowOutput {
  directory: string;
  nameTemplate: string;
}

export interface WorkflowRecovery {
  interruptedFiles: RecoveryStrategy;
  checkMissedFiles: boolean;
}

export interface WorkflowWatchOptions {
  ignoreTempFiles: boolean;
  tempPatterns: string[];
  ignoreHiddenFiles: boolean;
  minFileSize?: number;
}

export interface WorkflowTaskDefinition {
  id: string;
  type: TaskType;
  config: TaskConfig;
  onError: ErrorHandling;
}

export interface Workflow {
  id: string;
  name: string;
  type: WorkflowType;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  execution: WorkflowExecution;
  output: WorkflowOutput;
  tasks: WorkflowTaskDefinition[];
  recovery: WorkflowRecovery;
  watchOptions?: WorkflowWatchOptions;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowFile {
  id: string;
  workflowId: string;
  sourcePath: string;
  status: WorkflowFileStatus;
  taskStatuses: WorkflowFileTaskStatus[];
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowFileTaskStatus {
  taskId: string;
  status: WorkflowTaskStatus;
  bytesProcessed?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// -----------------------------------------------------------------------------
// User Context & Header Presets (for Download task)
// -----------------------------------------------------------------------------

export interface UserContext {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  headers: Record<string, string>;
}

export interface HeaderPreset {
  id: string;
  name: string;
  description?: string;
  headers: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Task Templates
// -----------------------------------------------------------------------------

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  baseTask: TaskType;
  config: Partial<TaskConfig>;
  lockedFields: string[];
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

export interface Dependency {
  name: string;
  binary: string;
  checkCommand: string;
  required: boolean;
  usedBy: TaskType[];
  available?: boolean;
  version?: string;
}

export const DEPENDENCIES: Dependency[] = [
  {
    name: 'FFmpeg',
    binary: 'ffmpeg',
    checkCommand: 'ffmpeg -version',
    required: true,
    usedBy: ['transcode', 'audio', 'thumbnail'],
  },
  {
    name: 'Rsync',
    binary: 'rsync',
    checkCommand: 'rsync --version',
    required: false,
    usedBy: ['rsync'],
  },
  {
    name: 'Rclone',
    binary: 'rclone',
    checkCommand: 'rclone version',
    required: false,
    usedBy: ['rclone'],
  },
  {
    name: 'Pigz',
    binary: 'pigz',
    checkCommand: 'pigz --version',
    required: false,
    usedBy: ['archive'],
  },
  {
    name: 'ImageMagick',
    binary: 'magick',
    checkCommand: 'magick --version',
    required: false,
    usedBy: ['image', 'thumbnail'],
  },
  {
    name: 'ExifTool',
    binary: 'exiftool',
    checkCommand: 'exiftool -ver',
    required: false,
    usedBy: ['metadata'],
  },
];

// -----------------------------------------------------------------------------
// App Settings
// -----------------------------------------------------------------------------

export interface AppSettings {
  pauseAllOnStartup: boolean;
  theme: 'light' | 'dark' | 'system';
  downloadDefaults: {
    defaultUserContextId?: string;
    defaultHeaderPresetIds: string[];
    defaultTimeout: number;
    defaultRetryAttempts: number;
    defaultMaxConcurrent: number;
  };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  pauseAllOnStartup: false,
  theme: 'system',
  downloadDefaults: {
    defaultHeaderPresetIds: [],
    defaultTimeout: 30,
    defaultRetryAttempts: 3,
    defaultMaxConcurrent: 3,
  },
};

// -----------------------------------------------------------------------------
// Events (Backend -> Frontend)
// -----------------------------------------------------------------------------

export interface TaskProgressEvent {
  taskId: string;
  progress: number;
  bytesProcessed?: number;
  totalBytes?: number;
  status: TaskStatus;
}

export interface QueueStatusEvent {
  queueId: string;
  status: QueueStatus;
  runningCount: number;
  pendingCount: number;
}

export interface WorkflowStatusEvent {
  workflowId: string;
  status: WorkflowStatus;
  activeFiles: number;
  pendingFiles: number;
}

export interface WorkflowFileEvent {
  workflowId: string;
  fileId: string;
  sourcePath: string;
  status: WorkflowFileStatus;
  currentTask?: string;
  progress?: number;
}

export interface FileDetectedEvent {
  workflowId: string;
  filePath: string;
  fileSize: number;
}

export interface DependencyStatusEvent {
  dependency: string;
  available: boolean;
  version?: string;
}

export interface DownloadProgressEvent {
  taskId: string;
  urlIndex: number;
  url: string;
  bytesDownloaded: number;
  totalBytes?: number;
  speed: number;
  status: 'downloading' | 'completed' | 'failed' | 'retrying';
  error?: string;
}

// -----------------------------------------------------------------------------
// IPC Commands
// -----------------------------------------------------------------------------

export type IpcCommand =
  // Queue commands
  | { cmd: 'get_queues' }
  | { cmd: 'create_queue'; payload: { name: string; maxParallel?: number } }
  | { cmd: 'update_queue'; payload: { id: string; name?: string; maxParallel?: number } }
  | { cmd: 'delete_queue'; payload: { id: string } }
  | { cmd: 'start_queue'; payload: { id: string } }
  | { cmd: 'pause_queue'; payload: { id: string } }
  // Task commands
  | { cmd: 'get_tasks'; payload: { queueId: string } }
  | { cmd: 'create_task'; payload: { queueId: string; type: TaskType; config: TaskConfig } }
  | { cmd: 'cancel_task'; payload: { id: string } }
  | { cmd: 'delete_task'; payload: { id: string } }
  // Workflow commands
  | { cmd: 'get_workflows' }
  | { cmd: 'create_workflow'; payload: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> }
  | { cmd: 'update_workflow'; payload: Partial<Workflow> & { id: string } }
  | { cmd: 'delete_workflow'; payload: { id: string } }
  | { cmd: 'start_workflow'; payload: { id: string } }
  | { cmd: 'pause_workflow'; payload: { id: string } }
  // Settings commands
  | { cmd: 'get_settings' }
  | { cmd: 'update_settings'; payload: Partial<AppSettings> }
  // Dependency commands
  | { cmd: 'check_dependencies' }
  // Download preset commands
  | { cmd: 'get_user_contexts' }
  | { cmd: 'create_user_context'; payload: Omit<UserContext, 'id' | 'isBuiltIn'> }
  | { cmd: 'update_user_context'; payload: Partial<UserContext> & { id: string } }
  | { cmd: 'delete_user_context'; payload: { id: string } }
  | { cmd: 'get_header_presets' }
  | { cmd: 'create_header_preset'; payload: Omit<HeaderPreset, 'id' | 'createdAt' | 'updatedAt'> }
  | { cmd: 'update_header_preset'; payload: Partial<HeaderPreset> & { id: string } }
  | { cmd: 'delete_header_preset'; payload: { id: string } };
