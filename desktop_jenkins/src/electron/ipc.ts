import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { FilePickerOptions, Queue, Task } from '../src/shared/types';
import {
  addTaskToQueue,
  createQueue,
  listQueues,
  updateQueueStatus,
  updateTaskStatus,
  updateQueueCurrentIndex
} from './queues';
import { runTask } from './taskRunner';

const runningQueues = new Set<string>();

const runQueue = async (queueId: string) => {
  if (runningQueues.has(queueId)) {
    return;
  }
  runningQueues.add(queueId);
  updateQueueStatus(queueId, 'running');

  const queues = listQueues();
  const queue = queues.find((item: Queue) => item.id === queueId);
  if (!queue) {
    runningQueues.delete(queueId);
    return;
  }

  for (let index = queue.currentTaskIndex; index < queue.tasks.length; index += 1) {
    if (!runningQueues.has(queueId)) {
      updateQueueStatus(queueId, 'paused');
      updateQueueCurrentIndex(queueId, index);
      return;
    }
    const task = queue.tasks[index];
    const startedAt = new Date().toISOString();
    updateTaskStatus(task.id, 'running', { startedAt });

    try {
      await runTask(task as Task);
      updateTaskStatus(task.id, 'completed', { completedAt: new Date().toISOString() });
    } catch (error) {
      updateTaskStatus(task.id, 'failed', { error: (error as Error).message, completedAt: new Date().toISOString() });
      updateQueueStatus(queueId, 'paused');
      runningQueues.delete(queueId);
      updateQueueCurrentIndex(queueId, index);
      return;
    }
  }

  updateQueueStatus(queueId, 'completed');
  updateQueueCurrentIndex(queueId, queue.tasks.length);
  runningQueues.delete(queueId);
};

export const registerIpcHandlers = () => {
  ipcMain.handle('queues:list', () => listQueues());
  ipcMain.handle('queues:create', (_event, name: string) => createQueue(name));
  ipcMain.handle(
    'queues:add-task',
    (_event, queueId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>) =>
      addTaskToQueue(queueId, { name: task.name, type: task.type, config: task.config })
  );
  ipcMain.handle('queues:run', (_event, queueId: string) => runQueue(queueId));
  ipcMain.handle('queues:pause', (_event, queueId: string) => {
    runningQueues.delete(queueId);
    updateQueueStatus(queueId, 'paused');
  });
  ipcMain.handle('picker:open', async (_event, options: FilePickerOptions) => {
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> = [];
    if (options.mode === 'file') {
      properties.push('openFile');
    } else if (options.mode === 'directory') {
      properties.push('openDirectory');
    } else {
      properties.push('openFile', 'openDirectory');
    }
    if (options.allowMultiple) {
      properties.push('multiSelections');
    }

    const browserWindow = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showOpenDialog(browserWindow, {
      title: options.title,
      properties
    });
    if (result.canceled) {
      return [];
    }
    return result.filePaths;
  });
};
