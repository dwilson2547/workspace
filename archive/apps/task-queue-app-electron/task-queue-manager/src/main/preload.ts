import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  IPC_CHANNELS,
  Queue,
  Task,
  TaskConfig,
  TaskHistory,
  QueueType,
  ApiResponse,
  TaskProgressEvent,
  TaskStatusEvent,
  QueueStatusEvent,
} from '../shared/types';

// Type-safe API exposed to renderer
const api = {
  // Queue operations
  queue: {
    create: (data: { name: string; description?: string; type: QueueType }): Promise<ApiResponse<Queue>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_CREATE, data),
    
    update: (id: string, updates: Partial<Queue>): Promise<ApiResponse<Queue>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_UPDATE, { id, updates }),
    
    delete: (id: string): Promise<ApiResponse<boolean>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_DELETE, id),
    
    getAll: (): Promise<ApiResponse<Queue[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_GET_ALL),
    
    get: (id: string): Promise<ApiResponse<Queue>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_GET, id),
    
    start: (id: string): Promise<ApiResponse<Queue>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_START, id),
    
    pause: (id: string): Promise<ApiResponse<Queue>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_PAUSE, id),
    
    reset: (id: string): Promise<ApiResponse<Queue>> =>
      ipcRenderer.invoke(IPC_CHANNELS.QUEUE_RESET, id),
  },

  // Task operations
  task: {
    create: (data: { queueId: string; name: string; config: TaskConfig }): Promise<ApiResponse<Task>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, data),
    
    update: (id: string, updates: Partial<Task>): Promise<ApiResponse<Task>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, { id, updates }),
    
    delete: (id: string): Promise<ApiResponse<boolean>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, id),
    
    getAll: (queueId: string): Promise<ApiResponse<Task[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_GET_ALL, queueId),
    
    reorder: (queueId: string, taskIds: string[]): Promise<ApiResponse<boolean>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_REORDER, { queueId, taskIds }),
    
    cancel: (queueId: string): Promise<ApiResponse<boolean>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_CANCEL, queueId),
  },

  // History operations
  history: {
    getAll: (limit?: number): Promise<ApiResponse<TaskHistory[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_ALL, limit),
    
    getByQueue: (queueId: string, limit?: number): Promise<ApiResponse<TaskHistory[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_BY_QUEUE, { queueId, limit }),
    
    clear: (beforeDate?: string): Promise<ApiResponse<number>> =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR, beforeDate),
  },

  // Dialog operations
  dialog: {
    selectFile: (options?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
      multiple?: boolean;
    }): Promise<ApiResponse<string[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FILE, options),
    
    selectDirectory: (options?: {
      title?: string;
      multiple?: boolean;
    }): Promise<ApiResponse<string[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, options),
    
    selectSave: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
    }): Promise<ApiResponse<string | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_SAVE, options),
  },

  // Event listeners
  on: {
    taskProgress: (callback: (event: TaskProgressEvent) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, data: TaskProgressEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.TASK_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TASK_PROGRESS, handler);
    },
    
    taskStatusChanged: (callback: (event: TaskStatusEvent) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, data: TaskStatusEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.TASK_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TASK_STATUS_CHANGED, handler);
    },
    
    queueStatusChanged: (callback: (event: QueueStatusEvent) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, data: QueueStatusEvent) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.QUEUE_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.QUEUE_STATUS_CHANGED, handler);
    },
  },

  // App info
  app: {
    getVersion: (): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    
    getPaths: (): Promise<ApiResponse<{ userData: string; home: string; temp: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATHS),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', api);

// Type declaration for the renderer
export type ElectronAPI = typeof api;
