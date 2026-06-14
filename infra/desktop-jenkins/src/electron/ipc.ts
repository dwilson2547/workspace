import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import type {
  DirectoryWatcherConfig,
  FilePickerOptions,
  Queue,
  Task,
  Workflow,
  WorkflowTask
} from '../src/shared/types';
import {
  addTaskToQueue,
  archiveTask,
  createQueue,
  listQueues,
  removeQueueHistoryItem,
  removeTaskFromQueue,
  updateQueueStatus,
  updateTaskStatus,
  updateQueueCurrentIndex
} from './queues';
import {
  addWorkflowFiles,
  addWorkflowFolder,
  addWorkflowTask,
  clearWorkflowHistory,
  createWorkflow,
  getWorkflowById,
  listWorkflows,
  removeWorkflowFile,
  removeWorkflowHistoryItem,
  removeWorkflowTask,
  updateWorkflowWatcherConfig,
  updateWorkflowSettings
} from './workflows';
import { startWorkflowWatcher, stopWorkflowWatcher } from './watchers';
import { runTask } from './taskRunner';
import { pauseWorkflow, runWorkflow } from './workflowRunner';

const runningQueues = new Set<string>();

const runQueue = async (queueId: string) => {
  if (runningQueues.has(queueId)) {
    return;
  }
  runningQueues.add(queueId);
  updateQueueStatus(queueId, 'running');
  updateQueueCurrentIndex(queueId, 0);

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
      const completedAt = new Date().toISOString();
      const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
      updateTaskStatus(task.id, 'completed', { completedAt });
      archiveTask(queueId, { ...task, status: 'completed', startedAt, completedAt }, durationMs);
    } catch (error) {
      const completedAt = new Date().toISOString();
      const errorMessage = (error as Error).message;
      const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
      updateTaskStatus(task.id, 'failed', { error: errorMessage, completedAt });
      archiveTask(queueId, { ...task, status: 'failed', error: errorMessage, startedAt, completedAt }, durationMs);
      updateQueueStatus(queueId, 'paused');
      runningQueues.delete(queueId);
      updateQueueCurrentIndex(queueId, 0);
      return;
    }
  }

  updateQueueStatus(queueId, 'completed');
  updateQueueCurrentIndex(queueId, 0);
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
  ipcMain.handle('queues:remove-task', (_event, queueId: string, taskId: string) =>
    removeTaskFromQueue(queueId, taskId)
  );
  ipcMain.handle('queues:remove-history-item', (_event, queueId: string, historyId: string) =>
    removeQueueHistoryItem(queueId, historyId)
  );
  ipcMain.handle('queues:run', (_event, queueId: string) => runQueue(queueId));
  ipcMain.handle('queues:pause', (_event, queueId: string) => {
    runningQueues.delete(queueId);
    updateQueueStatus(queueId, 'paused');
  });
  ipcMain.handle('workflows:list', () => listWorkflows());
  ipcMain.handle('workflows:create', (_event, name: string) => createWorkflow(name));
  ipcMain.handle('workflows:add-task', (_event, workflowId: string, task: Omit<WorkflowTask, 'id' | 'order' | 'createdAt'>) =>
    addWorkflowTask(workflowId, { name: task.name, type: task.type, config: task.config })
  );
  ipcMain.handle('workflows:remove-task', (_event, workflowId: string, taskId: string) =>
    removeWorkflowTask(workflowId, taskId)
  );
  ipcMain.handle('workflows:add-files', (_event, workflowId: string, filePaths: string[]) =>
    addWorkflowFiles(workflowId, filePaths)
  );
  ipcMain.handle('workflows:add-folder', async (_event, workflowId: string, folderPath: string) =>
    addWorkflowFolder(workflowId, folderPath)
  );
  ipcMain.handle('workflows:update-settings', (
    _event,
    workflowId: string,
    settings: Pick<Workflow, 'executionMode' | 'maxParallel'>
  ) => updateWorkflowSettings(workflowId, settings));
  ipcMain.handle('workflows:update-watcher-config', (
    _event,
    workflowId: string,
    config: DirectoryWatcherConfig
  ) => updateWorkflowWatcherConfig(workflowId, config));
  ipcMain.handle('workflows:watcher-start', async (_event, workflowId: string) => {
    await startWorkflowWatcher(workflowId);
  });
  ipcMain.handle('workflows:watcher-stop', async (_event, workflowId: string) => {
    await stopWorkflowWatcher(workflowId);
  });
  ipcMain.handle('workflows:remove-file', (_event, workflowId: string, fileId: string) =>
    removeWorkflowFile(workflowId, fileId)
  );
  ipcMain.handle('workflows:remove-history-item', (_event, workflowId: string, historyId: string) =>
    removeWorkflowHistoryItem(workflowId, historyId)
  );
  ipcMain.handle('workflows:clear-history', (_event, workflowId: string) =>
    clearWorkflowHistory(workflowId)
  );
  ipcMain.handle('workflows:export-history', async (_event, workflowId: string) => {
    const workflow = getWorkflowById(workflowId);
    if (!workflow) {
      return null;
    }
    const browserWindow = BrowserWindow.getFocusedWindow();
    const suggestedName = `${workflow.name.replace(/\s+/g, '-').toLowerCase()}-history.json`;
    const dialogOptions = {
      title: 'Export Workflow History',
      defaultPath: suggestedName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    };
    const result = browserWindow
      ? await dialog.showSaveDialog(browserWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);
    if (result.canceled || !result.filePath) {
      return null;
    }
    await fs.writeFile(result.filePath, JSON.stringify(workflow.history, null, 2), 'utf-8');
    return result.filePath;
  });
  ipcMain.handle('workflows:run', (_event, workflowId: string) => runWorkflow(workflowId));
  ipcMain.handle('workflows:pause', (_event, workflowId: string) => {
    pauseWorkflow(workflowId);
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

    const browserWindow = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      title: options.title,
      properties
    };
    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled) {
      return [];
    }
    return result.filePaths;
  });
};
