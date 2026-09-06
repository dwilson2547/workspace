// Shared types between main and renderer processes

export type TaskType = 'copy' | 'zip' | 'tar' | 'transcode' | 'rsync' | 'delete' | 'custom';
export type QueueType = 'queue' | 'workflow';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type QueueStatus = 'paused' | 'running' | 'idle';

// Base task configuration
export interface BaseTaskConfig {
  type: TaskType;
}

export interface CopyTaskConfig extends BaseTaskConfig {
  type: 'copy';
  source: string;
  destination: string;
  overwrite?: boolean;
}

export interface ZipTaskConfig extends BaseTaskConfig {
  type: 'zip';
  inputs: string[];
  output: string;
  zipIndividually?: boolean; // If true, each folder is zipped separately to output directory
  compressionLevel?: number; // 0-9
}

export interface TarTaskConfig extends BaseTaskConfig {
  type: 'tar';
  inputs: string[];
  output: string;
  gzip?: boolean;
}

export interface TranscodeTaskConfig extends BaseTaskConfig {
  type: 'transcode';
  input: string;
  output: string;
  preset?: string;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: string;
  bitrate?: string;
  customArgs?: string[];
}

export interface RsyncTaskConfig extends BaseTaskConfig {
  type: 'rsync';
  source: string;
  destination: string;
  delete?: boolean;
  archive?: boolean;
  compress?: boolean;
  progress?: boolean;
  exclude?: string[];
  include?: string[];
  dryRun?: boolean;
}

export interface DeleteTaskConfig extends BaseTaskConfig {
  type: 'delete';
  paths: string[];
  recursive?: boolean;
  force?: boolean;
  moveToTrash?: boolean;
}

export interface CustomTaskConfig extends BaseTaskConfig {
  type: 'custom';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  shell?: boolean;
}

export type TaskConfig = 
  | CopyTaskConfig 
  | ZipTaskConfig 
  | TarTaskConfig 
  | TranscodeTaskConfig 
  | RsyncTaskConfig 
  | DeleteTaskConfig 
  | CustomTaskConfig;

// Task entity
export interface Task {
  id: string;
  queueId: string;
  name: string;
  config: TaskConfig;
  status: TaskStatus;
  progress: number;
  progressMessage?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  order: number;
}

// Queue/Workflow entity
export interface Queue {
  id: string;
  name: string;
  description?: string;
  type: QueueType;
  status: QueueStatus;
  createdAt: string;
  updatedAt: string;
  currentTaskId?: string;
}

// Task history entry
export interface TaskHistory {
  id: string;
  taskId: string;
  queueId: string;
  queueName: string;
  taskName: string;
  config: TaskConfig;
  status: TaskStatus;
  error?: string;
  startedAt: string;
  completedAt: string;
  duration: number; // in milliseconds
}

// IPC channel names
export const IPC_CHANNELS = {
  // Queue operations
  QUEUE_CREATE: 'queue:create',
  QUEUE_UPDATE: 'queue:update',
  QUEUE_DELETE: 'queue:delete',
  QUEUE_GET_ALL: 'queue:getAll',
  QUEUE_GET: 'queue:get',
  QUEUE_START: 'queue:start',
  QUEUE_PAUSE: 'queue:pause',
  QUEUE_RESET: 'queue:reset', // For workflows - reset all tasks to pending
  
  // Task operations
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_GET_ALL: 'task:getAll',
  TASK_REORDER: 'task:reorder',
  TASK_CANCEL: 'task:cancel',
  
  // History operations
  HISTORY_GET_ALL: 'history:getAll',
  HISTORY_GET_BY_QUEUE: 'history:getByQueue',
  HISTORY_CLEAR: 'history:clear',
  
  // File dialogs
  DIALOG_SELECT_FILE: 'dialog:selectFile',
  DIALOG_SELECT_DIRECTORY: 'dialog:selectDirectory',
  DIALOG_SELECT_SAVE: 'dialog:selectSave',
  
  // Events (main -> renderer)
  TASK_PROGRESS: 'task:progress',
  TASK_STATUS_CHANGED: 'task:statusChanged',
  QUEUE_STATUS_CHANGED: 'queue:statusChanged',
  
  // System
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PATHS: 'app:getPaths',
} as const;

// Event payloads
export interface TaskProgressEvent {
  taskId: string;
  queueId: string;
  progress: number;
  message?: string;
}

export interface TaskStatusEvent {
  taskId: string;
  queueId: string;
  status: TaskStatus;
  error?: string;
}

export interface QueueStatusEvent {
  queueId: string;
  status: QueueStatus;
  currentTaskId?: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
