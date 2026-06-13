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
} from '@tqm/shared';
import { DEFAULT_APP_SETTINGS } from '@tqm/shared';
import { ElectronBridge, isElectronMode } from '@/api/bridge';

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

  // Event handlers
  handleTaskProgress: (event: { taskId: string; progress: number; status: Task['status'] }) => void;
  handleQueueStatus: (event: { queueId: string; status: Queue['status'] }) => void;
  handleWorkflowStatus: (event: { workflowId: string; status: Workflow['status'] }) => void;
}

// =============================================================================
// Mock Data (for development without Electron)
// =============================================================================

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

async function mockDelay<T>(result: T, delay = 100): Promise<T> {
  await new Promise(resolve => setTimeout(resolve, delay));
  return result;
}

// =============================================================================
// Bridge Instance
// =============================================================================

let bridge: ElectronBridge | null = null;

function getBridge(): ElectronBridge | null {
  if (!isElectronMode()) {
    return null;
  }
  if (!bridge) {
    bridge = new ElectronBridge();
  }
  return bridge;
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
    const b = getBridge();
    if (!b) {
      const queues = await mockDelay(mockQueues);
      set({ queues });
      return;
    }
    const queues = await b.getQueues();
    set({ queues });
  },

  createQueue: async (name, maxParallel = 1) => {
    const b = getBridge();
    if (!b) {
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
    const queue = await b.createQueue(name, maxParallel);
    set(state => ({ queues: [...state.queues, queue] }));
    return queue;
  },

  updateQueue: async (id, updates) => {
    const b = getBridge();
    if (!b) {
      set(state => ({
        queues: state.queues.map(q =>
          q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
        ),
      }));
      return;
    }
    await b.updateQueue(id, updates);
    set(state => ({
      queues: state.queues.map(q =>
        q.id === id ? { ...q, ...updates, updatedAt: new Date().toISOString() } : q
      ),
    }));
  },

  deleteQueue: async (id) => {
    const b = getBridge();
    if (!b) {
      set(state => ({
        queues: state.queues.filter(q => q.id !== id),
        selectedQueueId: state.selectedQueueId === id ? null : state.selectedQueueId,
      }));
      return;
    }
    await b.deleteQueue(id);
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
    const b = getBridge();
    if (!b) {
      set(state => ({ tasks: { ...state.tasks, [queueId]: [] } }));
      return;
    }
    const tasks = await b.getTasks(queueId);
    set(state => ({ tasks: { ...state.tasks, [queueId]: tasks } }));
  },

  createTask: async (queueId, type, config) => {
    const b = getBridge();
    if (!b) {
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
    const task = await b.createTask(queueId, type, config);
    set(state => ({
      tasks: {
        ...state.tasks,
        [queueId]: [...(state.tasks[queueId] || []), task],
      },
    }));
    return task;
  },

  cancelTask: async (id) => {
    const b = getBridge();
    if (!b) {
      console.log('Cancel task:', id);
      return;
    }
    await b.cancelTask(id);
  },

  deleteTask: async (id) => {
    const b = getBridge();
    if (!b) {
      console.log('Delete task:', id);
      return;
    }
    await b.deleteTask(id);
  },

  // Workflow actions
  fetchWorkflows: async () => {
    const b = getBridge();
    if (!b) {
      const workflows = await mockDelay(mockWorkflows);
      set({ workflows });
      return;
    }
    const workflows = await b.getWorkflows();
    set({ workflows });
  },

  createWorkflow: async (workflow) => {
    const b = getBridge();
    if (!b) {
      const newWorkflow: Workflow = {
        ...workflow,
        id: `workflow-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set(state => ({ workflows: [...state.workflows, newWorkflow] }));
      return newWorkflow;
    }
    const newWorkflow = await b.createWorkflow(workflow);
    set(state => ({ workflows: [...state.workflows, newWorkflow] }));
    return newWorkflow;
  },

  updateWorkflow: async (id, updates) => {
    const b = getBridge();
    if (!b) {
      set(state => ({
        workflows: state.workflows.map(w =>
          w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
        ),
      }));
      return;
    }
    await b.updateWorkflow(id, updates);
    set(state => ({
      workflows: state.workflows.map(w =>
        w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
      ),
    }));
  },

  deleteWorkflow: async (id) => {
    const b = getBridge();
    if (!b) {
      set(state => ({
        workflows: state.workflows.filter(w => w.id !== id),
        selectedWorkflowId: state.selectedWorkflowId === id ? null : state.selectedWorkflowId,
      }));
      return;
    }
    await b.deleteWorkflow(id);
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
    const b = getBridge();
    if (!b) {
      set({ settings: { ...DEFAULT_APP_SETTINGS } });
      return;
    }
    const settings = await b.getSettings();
    set({ settings });
  },

  updateSettings: async (updates) => {
    const b = getBridge();
    if (!b) {
      set(state => ({ settings: { ...state.settings, ...updates } }));
      return;
    }
    await b.updateSettings(updates);
    set(state => ({ settings: { ...state.settings, ...updates } }));
  },

  // Preset actions
  fetchUserContexts: async () => {
    const b = getBridge();
    if (!b) {
      set({ userContexts: mockUserContexts });
      return;
    }
    const userContexts = await b.getUserContexts();
    set({ userContexts });
  },

  fetchHeaderPresets: async () => {
    const b = getBridge();
    if (!b) {
      set({ headerPresets: [] });
      return;
    }
    const headerPresets = await b.getHeaderPresets();
    set({ headerPresets });
  },

  // Dependency actions
  checkDependencies: async () => {
    const b = getBridge();
    if (!b) {
      set({ dependencies: [] });
      return;
    }
    const dependencies = await b.checkDependencies();
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

// Re-export for convenience
export { DEFAULT_APP_SETTINGS };
