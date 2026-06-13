import {
  IPC_CHANNELS,
  Queue,
  Task,
  TaskType,
  TaskConfig,
  Workflow,
  AppSettings,
  UserContext,
  HeaderPreset,
  TaskTemplate,
  Dependency,
  FileDialogOptions,
  TaskProgressEvent,
  QueueStatusEvent,
  WorkflowStatusEvent,
  WorkflowFileEvent,
  FileDetectedEvent,
  DownloadProgressEvent,
  DependencyStatusEvent,
} from '@tqm/shared';

export type UnsubscribeFn = () => void;

/**
 * Check if running in Electron environment
 */
export function isElectronMode(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

/**
 * Electron Bridge - provides access to backend functionality via IPC
 */
export class ElectronBridge {
  // ─────────────────────────────────────────────────────────────────────────
  // Queue Operations
  // ─────────────────────────────────────────────────────────────────────────

  async getQueues(): Promise<Queue[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.GET_QUEUES) as Promise<Queue[]>;
  }

  async createQueue(name: string, maxParallel?: number): Promise<Queue> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CREATE_QUEUE, { name, maxParallel }) as Promise<Queue>;
  }

  async updateQueue(id: string, updates: Partial<Pick<Queue, 'name' | 'maxParallel'>>): Promise<Queue> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.UPDATE_QUEUE, { id, ...updates }) as Promise<Queue>;
  }

  async deleteQueue(id: string): Promise<void> {
    await window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.DELETE_QUEUE, { id });
  }

  async startQueue(id: string): Promise<Queue> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.START_QUEUE, { id }) as Promise<Queue>;
  }

  async pauseQueue(id: string): Promise<Queue> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.PAUSE_QUEUE, { id }) as Promise<Queue>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────────────────

  async getTasks(queueId: string): Promise<Task[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.GET_TASKS, { queueId }) as Promise<Task[]>;
  }

  async createTask(queueId: string, type: TaskType, config: TaskConfig): Promise<Task> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CREATE_TASK, { queueId, type, config }) as Promise<Task>;
  }

  async cancelTask(id: string): Promise<Task> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CANCEL_TASK, { id }) as Promise<Task>;
  }

  async deleteTask(id: string): Promise<void> {
    await window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.DELETE_TASK, { id });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Workflow Operations
  // ─────────────────────────────────────────────────────────────────────────

  async getWorkflows(): Promise<Workflow[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.GET_WORKFLOWS) as Promise<Workflow[]>;
  }

  async createWorkflow(config: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CREATE_WORKFLOW, { config }) as Promise<Workflow>;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.UPDATE_WORKFLOW, { id, ...updates }) as Promise<Workflow>;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.DELETE_WORKFLOW, { id });
  }

  async startWorkflow(id: string): Promise<Workflow> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.START_WORKFLOW, { id }) as Promise<Workflow>;
  }

  async pauseWorkflow(id: string): Promise<Workflow> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.PAUSE_WORKFLOW, { id }) as Promise<Workflow>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settings Operations
  // ─────────────────────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.GET_SETTINGS) as Promise<AppSettings>;
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.UPDATE_SETTINGS, updates) as Promise<AppSettings>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // User Context Operations
  // ─────────────────────────────────────────────────────────────────────────

  async getUserContexts(): Promise<UserContext[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.GET_USER_CONTEXTS) as Promise<UserContext[]>;
  }

  async createUserContext(context: Omit<UserContext, 'id' | 'isBuiltIn'>): Promise<UserContext> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CREATE_USER_CONTEXT, { context }) as Promise<UserContext>;
  }

  async updateUserContext(id: string, updates: Partial<UserContext>): Promise<UserContext> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.UPDATE_USER_CONTEXT, { id, ...updates }) as Promise<UserContext>;
  }

  async deleteUserContext(id: string): Promise<void> {
    await window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.DELETE_USER_CONTEXT, { id });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Header Preset Operations
  // ─────────────────────────────────────────────────────────────────────────

  async getHeaderPresets(): Promise<HeaderPreset[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.GET_HEADER_PRESETS) as Promise<HeaderPreset[]>;
  }

  async createHeaderPreset(preset: Omit<HeaderPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<HeaderPreset> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CREATE_HEADER_PRESET, { preset }) as Promise<HeaderPreset>;
  }

  async updateHeaderPreset(id: string, updates: Partial<HeaderPreset>): Promise<HeaderPreset> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.UPDATE_HEADER_PRESET, { id, ...updates }) as Promise<HeaderPreset>;
  }

  async deleteHeaderPreset(id: string): Promise<void> {
    await window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.DELETE_HEADER_PRESET, { id });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Task Template Operations
  // ─────────────────────────────────────────────────────────────────────────

  async getTaskTemplates(): Promise<TaskTemplate[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.GET_TASK_TEMPLATES) as Promise<TaskTemplate[]>;
  }

  async createTaskTemplate(template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<TaskTemplate> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CREATE_TASK_TEMPLATE, { template }) as Promise<TaskTemplate>;
  }

  async updateTaskTemplate(id: string, updates: Partial<TaskTemplate>): Promise<TaskTemplate> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.UPDATE_TASK_TEMPLATE, { id, ...updates }) as Promise<TaskTemplate>;
  }

  async deleteTaskTemplate(id: string): Promise<void> {
    await window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.DELETE_TASK_TEMPLATE, { id });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // System Operations
  // ─────────────────────────────────────────────────────────────────────────

  async checkDependencies(): Promise<Dependency[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.CHECK_DEPENDENCIES) as Promise<Dependency[]>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File Dialog Operations
  // ─────────────────────────────────────────────────────────────────────────

  async selectDirectory(title?: string): Promise<string | null> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.SELECT_DIRECTORY, { title }) as Promise<string | null>;
  }

  async selectFiles(options?: FileDialogOptions): Promise<string[]> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.SELECT_FILES, options) as Promise<string[]>;
  }

  async selectFile(options?: FileDialogOptions): Promise<string | null> {
    return window.electronAPI!.invoke(IPC_CHANNELS.INVOKE.SELECT_FILE, options) as Promise<string | null>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  onTaskProgress(callback: (event: TaskProgressEvent) => void): UnsubscribeFn {
    return window.electronAPI!.on(IPC_CHANNELS.EVENTS.TASK_PROGRESS, callback as (...args: unknown[]) => void);
  }

  onQueueStatus(callback: (event: QueueStatusEvent) => void): UnsubscribeFn {
    return window.electronAPI!.on(IPC_CHANNELS.EVENTS.QUEUE_STATUS, callback as (...args: unknown[]) => void);
  }

  onWorkflowStatus(callback: (event: WorkflowStatusEvent) => void): UnsubscribeFn {
    return window.electronAPI!.on(IPC_CHANNELS.EVENTS.WORKFLOW_STATUS, callback as (...args: unknown[]) => void);
  }

  onWorkflowFile(callback: (event: WorkflowFileEvent) => void): UnsubscribeFn {
    return window.electronAPI!.on(IPC_CHANNELS.EVENTS.WORKFLOW_FILE, callback as (...args: unknown[]) => void);
  }

  onFileDetected(callback: (event: FileDetectedEvent) => void): UnsubscribeFn {
    return window.electronAPI!.on(IPC_CHANNELS.EVENTS.FILE_DETECTED, callback as (...args: unknown[]) => void);
  }

  onDownloadProgress(callback: (event: DownloadProgressEvent) => void): UnsubscribeFn {
    return window.electronAPI!.on(IPC_CHANNELS.EVENTS.DOWNLOAD_PROGRESS, callback as (...args: unknown[]) => void);
  }

  onDependencyStatus(callback: (event: DependencyStatusEvent) => void): UnsubscribeFn {
    return window.electronAPI!.on(IPC_CHANNELS.EVENTS.DEPENDENCY_STATUS, callback as (...args: unknown[]) => void);
  }
}

// Singleton instance
let bridgeInstance: ElectronBridge | null = null;

/**
 * Get the bridge instance
 */
export function getBridge(): ElectronBridge {
  if (!isElectronMode()) {
    throw new Error('Electron API not available. Must run in Electron.');
  }
  if (!bridgeInstance) {
    bridgeInstance = new ElectronBridge();
  }
  return bridgeInstance;
}

/**
 * React hook for accessing the bridge
 */
export function useBridge(): ElectronBridge | null {
  if (!isElectronMode()) {
    return null;
  }
  return getBridge();
}
