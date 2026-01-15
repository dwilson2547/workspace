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

export interface Queue {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  status: 'paused' | 'running' | 'completed';
  currentTaskIndex: number;
  createdAt: string;
  updatedAt: string;
}
