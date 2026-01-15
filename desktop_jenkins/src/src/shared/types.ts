export type TaskType = 'copy' | 'move' | 'delete';

export type WorkflowExecutionMode = 'sequential' | 'parallel';

export interface FilePickerOptions {
  mode: 'file' | 'directory' | 'fileOrDirectory';
  allowMultiple?: boolean;
  title?: string;
}

export interface TaskConfig {
  sourcePath: string;
  destinationPath?: string;
}

export interface WorkflowTaskConfig {
  destinationDirectory?: string;
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

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  tasks: WorkflowTask[];
  executionMode: WorkflowExecutionMode;
  maxParallel?: number;
  fileQueue: WorkflowFile[];
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
  startWorkflowWatcher: (workflowId: string) => Promise<void>;
  stopWorkflowWatcher: (workflowId: string) => Promise<void>;
  runWorkflow: (workflowId: string) => Promise<void>;
  pauseWorkflow: (workflowId: string) => Promise<void>;
  pickPath: (options: FilePickerOptions) => Promise<string[]>;
}
