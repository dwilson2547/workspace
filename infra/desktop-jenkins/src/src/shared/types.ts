export type TaskType =
  | 'copy'
  | 'move'
  | 'delete'
  | 'rsync'
  | 'ffmpeg'
  | 'archiveCreate'
  | 'archiveExtract'
  | 'chmod'
  | 'chown'
  | 'ftp'
  | 'sftp';

export type WorkflowExecutionMode = 'sequential' | 'parallel';

export interface FilePickerOptions {
  mode: 'file' | 'directory' | 'fileOrDirectory';
  allowMultiple?: boolean;
  title?: string;
}

export interface TaskConfig {
  sourcePath: string;
  destinationPath?: string;
  rsyncArgs?: string;
  ffmpegArgs?: string;
  ffmpegCodec?: string;
  ffmpegCq?: number;
  outputExtension?: string;
  archiveFormat?: 'zip' | 'tar' | 'tar.gz';
  chmodMode?: string;
  chmodRecursive?: boolean;
  chownUser?: string;
  chownGroup?: string;
  chownRecursive?: boolean;
  ftpHost?: string;
  ftpPort?: number;
  ftpUsername?: string;
  ftpPassword?: string;
  ftpRemotePath?: string;
  ftpDirection?: 'upload' | 'download';
  ftpSecure?: boolean;
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  sftpPassword?: string;
  sftpRemotePath?: string;
  sftpDirection?: 'upload' | 'download';
}

export interface WorkflowTaskConfig {
  destinationDirectory?: string;
  destinationName?: string;
  rsyncArgs?: string;
  ffmpegArgs?: string;
  ffmpegCodec?: string;
  ffmpegCq?: number;
  outputExtension?: string;
  archiveFormat?: 'zip' | 'tar' | 'tar.gz';
  chmodMode?: string;
  chmodRecursive?: boolean;
  chownUser?: string;
  chownGroup?: string;
  chownRecursive?: boolean;
  ftpHost?: string;
  ftpPort?: number;
  ftpUsername?: string;
  ftpPassword?: string;
  ftpRemotePath?: string;
  ftpSecure?: boolean;
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  sftpPassword?: string;
  sftpRemotePath?: string;
}

export interface FileFilter {
  extensions?: string[];
  pattern?: string;
  minSize?: number;
  maxSize?: number;
}

export interface DirectoryWatcherConfig {
  enabled: boolean;
  watchPath: string;
  recursive: boolean;
  filters: {
    extensions?: string[];
    filenamePattern?: string;
    ignoreHidden?: boolean;
    minSize?: number;
  };
  ignoreExisting: boolean;
  stabilityDelay: number;
  pollInterval?: number;
}

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  config: TaskConfig;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskHistoryEntry {
  id: string;
  queueId: string;
  task: Task;
  durationMs?: number;
}

export interface WorkflowTask {
  id: string;
  type: TaskType;
  name: string;
  config: WorkflowTaskConfig;
  order: number;
  createdAt: string;
}

export interface WorkflowFile {
  id: string;
  workflowId: string;
  filePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentTaskIndex: number;
  error?: string;
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowTaskStatus {
  taskId: string;
  name: string;
  type: TaskType;
  order: number;
  status: 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowFileHistory {
  id: string;
  workflowId: string;
  filePath: string;
  status: 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  taskStatuses: WorkflowTaskStatus[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  tasks: WorkflowTask[];
  executionMode: WorkflowExecutionMode;
  maxParallel?: number;
  fileQueue: WorkflowFile[];
  history: WorkflowFileHistory[];
  status: 'idle' | 'running' | 'paused';
  watcherConfig?: DirectoryWatcherConfig;
  createdAt: string;
  updatedAt: string;
}

export interface Queue {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  history: TaskHistoryEntry[];
  status: 'paused' | 'running' | 'completed';
  currentTaskIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ElectronAPI {
  listQueues: () => Promise<Queue[]>;
  createQueue: (name: string) => Promise<Queue>;
  addTask: (queueId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>) => Promise<Task>;
  removeTask: (queueId: string, taskId: string) => Promise<boolean>;
  removeQueueHistoryItem: (queueId: string, historyId: string) => Promise<boolean>;
  runQueue: (queueId: string) => Promise<void>;
  pauseQueue: (queueId: string) => Promise<void>;
  listWorkflows: () => Promise<Workflow[]>;
  createWorkflow: (name: string) => Promise<Workflow>;
  addWorkflowTask: (
    workflowId: string,
    task: Omit<WorkflowTask, 'id' | 'order' | 'createdAt'>
  ) => Promise<WorkflowTask>;
  removeWorkflowTask: (workflowId: string, taskId: string) => Promise<boolean>;
  addWorkflowFiles: (workflowId: string, filePaths: string[]) => Promise<WorkflowFile[]>;
  addWorkflowFolder: (workflowId: string, folderPath: string) => Promise<WorkflowFile[]>;
  updateWorkflowSettings: (
    workflowId: string,
    settings: Pick<Workflow, 'executionMode' | 'maxParallel'>
  ) => Promise<Workflow>;
  updateWorkflowWatcherConfig: (
    workflowId: string,
    config: DirectoryWatcherConfig
  ) => Promise<Workflow>;
  removeWorkflowFile: (workflowId: string, fileId: string) => Promise<boolean>;
  removeWorkflowHistoryItem: (workflowId: string, historyId: string) => Promise<boolean>;
  clearWorkflowHistory: (workflowId: string) => Promise<number>;
  exportWorkflowHistory: (workflowId: string) => Promise<string | null>;
  startWorkflowWatcher: (workflowId: string) => Promise<void>;
  stopWorkflowWatcher: (workflowId: string) => Promise<void>;
  runWorkflow: (workflowId: string) => Promise<void>;
  pauseWorkflow: (workflowId: string) => Promise<void>;
  pickPath: (options: FilePickerOptions) => Promise<string[]>;
}
