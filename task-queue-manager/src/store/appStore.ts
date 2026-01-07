import { create } from 'zustand';
import type {
  Queue,
  Task,
  Workflow,
  WorkflowFile,
  AppSettings,
  UserContext,
  HeaderPreset,
  TaskTemplate,
  Dependency,
} from '@/types';
import { DEFAULT_APP_SETTINGS } from '@/types';

// =============================================================================
// Store Types
// =============================================================================

interface AppState {
  // Initialization
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Data
  queues: Queue[];
  tasks: Record<string, Task[]>; // queueId -> tasks
  workflows: Workflow[];
  workflowFiles: Record<string, WorkflowFile[]>; // workflowId -> files
  settings: AppSettings;
  userContexts: UserContext[];
  headerPresets: HeaderPreset[];
  taskTemplates: TaskTemplate[];
  dependencies: Dependency[];

  // UI State
  selectedQueueId: string | null;
  selectedWorkflowId: string | null;
  sidebarCollapsed: boolean;

  // Actions
  initialize: () => Promise<void>;
  
  // Queue actions
  fetchQueues: () => Promise<void>;
  createQueue: (name: string, maxParallel?: number) => Promise<Queue>;
  updateQueue: (id: string, updates: Partial<Queue>) => Promise<void>;
  deleteQueue: (id: string) => Promise<void>;
  startQueue: (id: string) => Promise<void>;
  pauseQueue: (id: string) => Promise<void>;
  selectQueue: (id: string | null) => void;

  // Task actions
  fetchTasks: (queueId: string) => Promise<void>;
  createTask: (queueId: string, type: Task['type'], config: Task['config']) => Promise<Task>;
  cancelTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Workflow actions
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Workflow>;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  startWorkflow: (id: string) => Promise<void>;
  pauseWorkflow: (id: string) => Promise<void>;
  selectWorkflow: (id: string | null) => void;

  // Settings actions
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;

  // Preset actions
  fetchUserContexts: () => Promise<void>;
  fetchHeaderPresets: () => Promise<void>;

  // Dependency actions
  checkDependencies: () => Promise<void>;

  // UI actions
  toggleSidebar: () => void;

  // Event handlers (for Tauri events)
  handleTaskProgress: (event: { taskId: string; progress: number; status: Task['status'] }) => void;
  handleQueueStatus: (event: { queueId: string; status: Queue['status'] }) => void;
  handleWorkflowStatus: (event: { workflowId: string; status: Workflow['status'] }) => void;
}

// =============================================================================
// Mock IPC (will be replaced with actual Tauri IPC)
// =============================================================================

// For development without Tauri, we'll use mock data
const isMockMode = typeof window !== 'undefined' && !(window as unknown as { __TAURI__?: unknown }).__TAURI__;

const mockQueues: Queue[] = [
  {
    id: 'queue-1',
    name: 'Main Queue',
    status: 'idle',
    maxParallel: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'queue-2',
    name: 'Background Tasks',
    status: 'running',
    maxParallel: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockWorkflows: Workflow[] = [
  {
    id: 'workflow-1',
    name: 'Video Processing',
    type: 'file_pipeline',
    status: 'idle',
    trigger: {
      type: 'watch',
      path: '/videos/incoming',
      filePattern: '*.{mp4,mkv,mov}',
      recursive: true,
    },
    execution: {
      mode: 'sequential',
      maxParallel: 1,
    },
    output: {
      directory: '/videos/processed',
      nameTemplate: '{filename}_processed.{ext}',
    },
    tasks: [],
    recovery: {
      interruptedFiles: 'ask',
      checkMissedFiles: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockUserContexts: UserContext[] = [
  {
    id: 'chrome-windows',
    name: 'Chrome (Windows)',
    description: 'Chrome 120 on Windows 11',
    isBuiltIn: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  },
  {
    id: 'curl',
    name: 'curl',
    description: 'Minimal headers like command-line curl',
    isBuiltIn: true,
    headers: {
      'User-Agent': 'curl/8.4.0',
      'Accept': '*/*',
    },
  },
];

async function mockIpc<T>(result: T, delay = 100): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, delay));
  return result;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isLoading: false,
  error: null,
  queues: [],
  tasks: {},
  workflows: [],
  workflowFiles: {},
  settings: { ...DEFAULT_APP_SETTINGS },
  userContexts: [],
  headerPresets: [],
  taskTemplates: [],
  dependencies: [],
  selectedQueueId: null,
  selectedWorkflowId: null,
  sidebarCollapsed: false,

  // Initialize app
  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      await Promise.all([
        get().fetchQueues(),
        get().fetchWorkflows(),
        get().fetchSettings(),
        get().fetchUserContexts(),
        get().fetchHeaderPresets(),
        get().checkDependencies(),
      ]);
      set({ isInitialized: true, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to initialize', 
        isLoading: false 
      });
    }
  },

  // Queue actions
  fetchQueues: async () => {
    if (isMockMode) {
      const queues = await mockIpc(mockQueues);
      set({ queues });
      return;
    }
    // TODO: Tauri IPC
    const { invoke } = await import('@tauri-apps/api/core');
    const queues = await invoke<Queue[]>('get_queues');
    set({ queues });
  },

  createQueue: async (name, maxParallel = 1) => {
    if (isMockMode) {
      const queue: Queue = {
        id: `queue-${Date.now()}`,
        name,
        status: 'idle',
        maxParallel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set(state => ({ queues: [...state.queues, queue] }));
      return queue;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const queue = await invoke<Queue>('create_queue', { name, maxParallel });
    set(state => ({ queues: [...state.queues, queue] }));
    return queue;
  },

  updateQueue: async (id, updates) => {
    if (isMockMode) {
      set(state => ({
        queues: state.queues.map(q => 
          q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
        ),
      }));
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_queue', { id, ...updates });
    set(state => ({
      queues: state.queues.map(q => 
        q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
      ),
    }));
  },

  deleteQueue: async (id) => {
    if (isMockMode) {
      set(state => ({
        queues: state.queues.filter(q => q.id !== id),
        selectedQueueId: state.selectedQueueId === id ? null : state.selectedQueueId,
      }));
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_queue', { id });
    set(state => ({
      queues: state.queues.filter(q => q.id !== id),
      selectedQueueId: state.selectedQueueId === id ? null : state.selectedQueueId,
    }));
  },

  startQueue: async (id) => {
    await get().updateQueue(id, { status: 'running' });
  },

  pauseQueue: async (id) => {
    await get().updateQueue(id, { status: 'paused' });
  },

  selectQueue: (id) => {
    set({ selectedQueueId: id, selectedWorkflowId: null });
  },

  // Task actions
  fetchTasks: async (queueId) => {
    if (isMockMode) {
      set(state => ({ tasks: { ...state.tasks, [queueId]: [] } }));
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const tasks = await invoke<Task[]>('get_tasks', { queueId });
    set(state => ({ tasks: { ...state.tasks, [queueId]: tasks } }));
  },

  createTask: async (queueId, type, config) => {
    if (isMockMode) {
      const task: Task = {
        id: `task-${Date.now()}`,
        queueId,
        type,
        config,
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
      };
      set(state => ({
        tasks: {
          ...state.tasks,
          [queueId]: [...(state.tasks[queueId] || []), task],
        },
      }));
      return task;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const task = await invoke<Task>('create_task', { queueId, type, config });
    set(state => ({
      tasks: {
        ...state.tasks,
        [queueId]: [...(state.tasks[queueId] || []), task],
      },
    }));
    return task;
  },

  cancelTask: async (id) => {
    // TODO: Implement
    console.log('Cancel task:', id);
  },

  deleteTask: async (id) => {
    // TODO: Implement
    console.log('Delete task:', id);
  },

  // Workflow actions
  fetchWorkflows: async () => {
    if (isMockMode) {
      const workflows = await mockIpc(mockWorkflows);
      set({ workflows });
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const workflows = await invoke<Workflow[]>('get_workflows');
    set({ workflows });
  },

  createWorkflow: async (workflow) => {
    if (isMockMode) {
      const newWorkflow: Workflow = {
        ...workflow,
        id: `workflow-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set(state => ({ workflows: [...state.workflows, newWorkflow] }));
      return newWorkflow;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const newWorkflow = await invoke<Workflow>('create_workflow', workflow);
    set(state => ({ workflows: [...state.workflows, newWorkflow] }));
    return newWorkflow;
  },

  updateWorkflow: async (id, updates) => {
    if (isMockMode) {
      set(state => ({
        workflows: state.workflows.map(w => 
          w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
        ),
      }));
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_workflow', { id, ...updates });
    set(state => ({
      workflows: state.workflows.map(w => 
        w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
      ),
    }));
  },

  deleteWorkflow: async (id) => {
    if (isMockMode) {
      set(state => ({
        workflows: state.workflows.filter(w => w.id !== id),
        selectedWorkflowId: state.selectedWorkflowId === id ? null : state.selectedWorkflowId,
      }));
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_workflow', { id });
    set(state => ({
      workflows: state.workflows.filter(w => w.id !== id),
      selectedWorkflowId: state.selectedWorkflowId === id ? null : state.selectedWorkflowId,
    }));
  },

  startWorkflow: async (id) => {
    await get().updateWorkflow(id, { status: 'running' });
  },

  pauseWorkflow: async (id) => {
    await get().updateWorkflow(id, { status: 'paused' });
  },

  selectWorkflow: (id) => {
    set({ selectedWorkflowId: id, selectedQueueId: null });
  },

  // Settings actions
  fetchSettings: async () => {
    if (isMockMode) {
      set({ settings: { ...DEFAULT_APP_SETTINGS } });
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const settings = await invoke<AppSettings>('get_settings');
    set({ settings });
  },

  updateSettings: async (updates) => {
    if (isMockMode) {
      set(state => ({ settings: { ...state.settings, ...updates } }));
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_settings', updates);
    set(state => ({ settings: { ...state.settings, ...updates } }));
  },

  // Preset actions
  fetchUserContexts: async () => {
    if (isMockMode) {
      set({ userContexts: mockUserContexts });
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const userContexts = await invoke<UserContext[]>('get_user_contexts');
    set({ userContexts });
  },

  fetchHeaderPresets: async () => {
    if (isMockMode) {
      set({ headerPresets: [] });
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const headerPresets = await invoke<HeaderPreset[]>('get_header_presets');
    set({ headerPresets });
  },

  // Dependency actions
  checkDependencies: async () => {
    if (isMockMode) {
      set({ dependencies: [] });
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const dependencies = await invoke<Dependency[]>('check_dependencies');
    set({ dependencies });
  },

  // UI actions
  toggleSidebar: () => {
    set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  // Event handlers
  handleTaskProgress: (event) => {
    set(state => {
      const newTasks = { ...state.tasks };
      for (const queueId in newTasks) {
        newTasks[queueId] = newTasks[queueId].map(task =>
          task.id === event.taskId
            ? { ...task, progress: event.progress, status: event.status }
            : task
        );
      }
      return { tasks: newTasks };
    });
  },

  handleQueueStatus: (event) => {
    set(state => ({
      queues: state.queues.map(q =>
        q.id === event.queueId ? { ...q, status: event.status } : q
      ),
    }));
  },

  handleWorkflowStatus: (event) => {
    set(state => ({
      workflows: state.workflows.map(w =>
        w.id === event.workflowId ? { ...w, status: event.status } : w
      ),
    }));
  },
}));

// Default export for convenience
export { DEFAULT_APP_SETTINGS };
