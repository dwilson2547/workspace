import { contextBridge, ipcRenderer } from 'electron';
import type { FilePickerOptions, Queue, Task } from '../src/shared/types';

contextBridge.exposeInMainWorld('api', {
  listQueues: (): Promise<Queue[]> => ipcRenderer.invoke('queues:list'),
  createQueue: (name: string): Promise<Queue> => ipcRenderer.invoke('queues:create', name),
  addTask: (queueId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>): Promise<Task> =>
    ipcRenderer.invoke('queues:add-task', queueId, task),
  removeTask: (queueId: string, taskId: string): Promise<boolean> =>
    ipcRenderer.invoke('queues:remove-task', queueId, taskId),
  runQueue: (queueId: string): Promise<void> => ipcRenderer.invoke('queues:run', queueId),
  pauseQueue: (queueId: string): Promise<void> => ipcRenderer.invoke('queues:pause', queueId),
  pickPath: (options: FilePickerOptions): Promise<string[]> => ipcRenderer.invoke('picker:open', options)
});
