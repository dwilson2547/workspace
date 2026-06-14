import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../database';
import { queueService } from '../services/queue-service';
import { validateTaskConfig } from '../executors';
import {
  IPC_CHANNELS,
  Queue,
  Task,
  TaskConfig,
  ApiResponse,
  QueueType,
} from '../../shared/types';

export function setupIpcHandlers(): void {
  // ============ Queue Operations ============
  
  ipcMain.handle(IPC_CHANNELS.QUEUE_CREATE, async (_, data: { name: string; description?: string; type: QueueType }): Promise<ApiResponse<Queue>> => {
    try {
      const queue = db.createQueue({
        id: uuidv4(),
        name: data.name,
        description: data.description,
        type: data.type,
        status: 'paused', // Always start paused
      });
      return { success: true, data: queue };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_UPDATE, async (_, data: { id: string; updates: Partial<Queue> }): Promise<ApiResponse<Queue>> => {
    try {
      const queue = db.updateQueue(data.id, data.updates);
      if (!queue) {
        return { success: false, error: 'Queue not found' };
      }
      return { success: true, data: queue };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_DELETE, async (_, queueId: string): Promise<ApiResponse<boolean>> => {
    try {
      // Stop the queue first if running
      await queueService.pauseQueue(queueId);
      
      const deleted = db.deleteQueue(queueId);
      return { success: true, data: deleted };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_GET_ALL, async (): Promise<ApiResponse<Queue[]>> => {
    try {
      const queues = db.getAllQueues();
      return { success: true, data: queues };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_GET, async (_, queueId: string): Promise<ApiResponse<Queue>> => {
    try {
      const queue = db.getQueue(queueId);
      if (!queue) {
        return { success: false, error: 'Queue not found' };
      }
      return { success: true, data: queue };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_START, async (_, queueId: string): Promise<ApiResponse<Queue>> => {
    try {
      const queue = await queueService.startQueue(queueId);
      if (!queue) {
        return { success: false, error: 'Queue not found' };
      }
      return { success: true, data: queue };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_PAUSE, async (_, queueId: string): Promise<ApiResponse<Queue>> => {
    try {
      const queue = await queueService.pauseQueue(queueId);
      if (!queue) {
        return { success: false, error: 'Queue not found' };
      }
      return { success: true, data: queue };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.QUEUE_RESET, async (_, queueId: string): Promise<ApiResponse<Queue>> => {
    try {
      const queue = queueService.resetWorkflow(queueId);
      if (!queue) {
        return { success: false, error: 'Queue not found or cannot reset (must be workflow and paused)' };
      }
      return { success: true, data: queue };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ============ Task Operations ============

  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, async (_, data: { queueId: string; name: string; config: TaskConfig }): Promise<ApiResponse<Task>> => {
    try {
      // Validate config
      const validation = validateTaskConfig(data.config);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const task = db.createTask({
        id: uuidv4(),
        queueId: data.queueId,
        name: data.name,
        config: data.config,
        status: 'pending',
        progress: 0,
      });
      return { success: true, data: task };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, async (_, data: { id: string; updates: Partial<Task> }): Promise<ApiResponse<Task>> => {
    try {
      const task = db.updateTask(data.id, data.updates);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }
      return { success: true, data: task };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, async (_, taskId: string): Promise<ApiResponse<boolean>> => {
    try {
      const deleted = db.deleteTask(taskId);
      return { success: true, data: deleted };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TASK_GET_ALL, async (_, queueId: string): Promise<ApiResponse<Task[]>> => {
    try {
      const tasks = db.getTasksByQueue(queueId);
      return { success: true, data: tasks };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TASK_REORDER, async (_, data: { queueId: string; taskIds: string[] }): Promise<ApiResponse<boolean>> => {
    try {
      db.reorderTasks(data.queueId, data.taskIds);
      return { success: true, data: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.TASK_CANCEL, async (_, queueId: string): Promise<ApiResponse<boolean>> => {
    try {
      const cancelled = queueService.cancelCurrentTask(queueId);
      return { success: true, data: cancelled };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ============ History Operations ============

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_ALL, async (_, limit?: number): Promise<ApiResponse<any[]>> => {
    try {
      const history = db.getAllHistory(limit);
      return { success: true, data: history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_GET_BY_QUEUE, async (_, data: { queueId: string; limit?: number }): Promise<ApiResponse<any[]>> => {
    try {
      const history = db.getHistoryByQueue(data.queueId, data.limit);
      return { success: true, data: history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, async (_, beforeDate?: string): Promise<ApiResponse<number>> => {
    try {
      const deleted = db.clearHistory(beforeDate);
      return { success: true, data: deleted };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ============ File Dialogs ============

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILE, async (_, options?: { 
    title?: string; 
    filters?: { name: string; extensions: string[] }[];
    multiple?: boolean;
  }): Promise<ApiResponse<string[]>> => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win!, {
        title: options?.title || 'Select File',
        properties: options?.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: options?.filters,
      });
      
      if (result.canceled) {
        return { success: true, data: [] };
      }
      return { success: true, data: result.filePaths };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async (_, options?: {
    title?: string;
    multiple?: boolean;
  }): Promise<ApiResponse<string[]>> => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win!, {
        title: options?.title || 'Select Directory',
        properties: options?.multiple ? ['openDirectory', 'multiSelections'] : ['openDirectory'],
      });
      
      if (result.canceled) {
        return { success: true, data: [] };
      }
      return { success: true, data: result.filePaths };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_SAVE, async (_, options?: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<ApiResponse<string | null>> => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win!, {
        title: options?.title || 'Save File',
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
      
      if (result.canceled) {
        return { success: true, data: null };
      }
      return { success: true, data: result.filePath || null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ============ System ============

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, async (): Promise<ApiResponse<string>> => {
    return { success: true, data: app.getVersion() };
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_PATHS, async (): Promise<ApiResponse<{ userData: string; home: string; temp: string }>> => {
    return {
      success: true,
      data: {
        userData: app.getPath('userData'),
        home: app.getPath('home'),
        temp: app.getPath('temp'),
      },
    };
  });
}
