export type TaskType = 'copy' | 'move' | 'delete';

export interface FilePickerOptions {
  mode: 'file' | 'directory' | 'fileOrDirectory';
  allowMultiple?: boolean;
  title?: string;
}

export interface TaskConfig {
  sourcePath: string;
  destinationPath?: string;
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
  pickPath: (options: FilePickerOptions) => Promise<string[]>;
}
