import { contextBridge, ipcRenderer } from 'electron';
import type {
  FilePickerOptions,
  Queue,
  Task,
  DirectoryWatcherConfig,
  Workflow,
  WorkflowFile,
  WorkflowTask
} from '../src/shared/types';

contextBridge.exposeInMainWorld('api', {
  listQueues: (): Promise<Queue[]> => ipcRenderer.invoke('queues:list'),
  createQueue: (name: string): Promise<Queue> => ipcRenderer.invoke('queues:create', name),
  addTask: (queueId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<Task> =>
    ipcRenderer.invoke('queues:add-task', queueId, task),
  removeTask: (queueId: string, taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('queues:remove-task', queueId, taskId),
  removeQueueHistoryItem: (queueId: string, historyId: string): Promise<boolean> =>
    ipcRenderer.invoke('queues:remove-history-item', queueId, historyId),
  runQueue: (queueId: string): Promise<void> => ipcRenderer.invoke('queues:run', queueId),
  pauseQueue: (queueId: string): Promise<void> => ipcRenderer.invoke('queues:pause', queueId),
  listWorkflows: (): Promise<Workflow[]> => ipcRenderer.invoke('workflows:list'),
  createWorkflow: (name: string): Promise<Workflow> => ipcRenderer.invoke('workflows:create', name),
  addWorkflowTask: (
    workflowId: string,
    task: Omit<WorkflowTask, 'id' | 'order' | 'createdAt'>
  ): Promise<WorkflowTask> => ipcRenderer.invoke('workflows:add-task', workflowId, task),
  removeWorkflowTask: (workflowId: string, taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('workflows:remove-task', workflowId, taskId),
  addWorkflowFiles: (workflowId: string, filePaths: string[]): Promise<WorkflowFile[]> =>
    ipcRenderer.invoke('workflows:add-files', workflowId, filePaths),
  addWorkflowFolder: (workflowId: string, folderPath: string): Promise<WorkflowFile[]> =>
    ipcRenderer.invoke('workflows:add-folder', workflowId, folderPath),
  updateWorkflowSettings: (
    workflowId: string,
    settings: Pick<Workflow, 'executionMode' | 'maxParallel'>
  ): Promise<Workflow> => ipcRenderer.invoke('workflows:update-settings', workflowId, settings),
  updateWorkflowWatcherConfig: (
    workflowId: string,
    config: DirectoryWatcherConfig
  ): Promise<Workflow> => ipcRenderer.invoke('workflows:update-watcher-config', workflowId, config),
  removeWorkflowFile: (workflowId: string, fileId: string): Promise<boolean> =>
    ipcRenderer.invoke('workflows:remove-file', workflowId, fileId),
  removeWorkflowHistoryItem: (workflowId: string, historyId: string): Promise<boolean> =>
    ipcRenderer.invoke('workflows:remove-history-item', workflowId, historyId),
  clearWorkflowHistory: (workflowId: string): Promise<number> =>
    ipcRenderer.invoke('workflows:clear-history', workflowId),
  exportWorkflowHistory: (workflowId: string): Promise<string | null> =>
    ipcRenderer.invoke('workflows:export-history', workflowId),
  startWorkflowWatcher: (workflowId: string): Promise<void> =>
    ipcRenderer.invoke('workflows:watcher-start', workflowId),
  stopWorkflowWatcher: (workflowId: string): Promise<void> =>
    ipcRenderer.invoke('workflows:watcher-stop', workflowId),
  runWorkflow: (workflowId: string): Promise<void> => ipcRenderer.invoke('workflows:run', workflowId),
  pauseWorkflow: (workflowId: string): Promise<void> => ipcRenderer.invoke('workflows:pause', workflowId),
  pickPath: (options: FilePickerOptions): Promise<string[]> => ipcRenderer.invoke('picker:open', options)
});
