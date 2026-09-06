import { create } from 'zustand';
import { Queue, Task, TaskProgressEvent, TaskStatusEvent, QueueStatusEvent } from '@shared/types';

interface AppState {
  // Queues
  queues: Queue[];
  selectedQueueId: string | null;
  
  // Tasks (for currently selected queue)
  tasks: Task[];
  
  // Loading states
  isLoadingQueues: boolean;
  isLoadingTasks: boolean;
  
  // UI state
  sidebarCollapsed: boolean;
  activeTab: 'dashboard' | 'queues' | 'history' | 'settings';
  
  // Actions
  setQueues: (queues: Queue[]) => void;
  updateQueue: (queue: Queue) => void;
  addQueue: (queue: Queue) => void;
  removeQueue: (queueId: string) => void;
  setSelectedQueueId: (id: string | null) => void;
  
  setTasks: (tasks: Task[]) => void;
  updateTask: (task: Task) => void;
  addTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
  updateTaskProgress: (event: TaskProgressEvent) => void;
  updateTaskStatus: (event: TaskStatusEvent) => void;
  updateQueueStatus: (event: QueueStatusEvent) => void;
  
  setLoadingQueues: (loading: boolean) => void;
  setLoadingTasks: (loading: boolean) => void;
  
  toggleSidebar: () => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  queues: [],
  selectedQueueId: null,
  tasks: [],
  isLoadingQueues: false,
  isLoadingTasks: false,
  sidebarCollapsed: false,
  activeTab: 'dashboard',

  // Queue actions
  setQueues: (queues) => set({ queues }),
  
  updateQueue: (queue) => set((state) => ({
    queues: state.queues.map((q) => (q.id === queue.id ? queue : q)),
  })),
  
  addQueue: (queue) => set((state) => ({
    queues: [queue, ...state.queues],
  })),
  
  removeQueue: (queueId) => set((state) => ({
    queues: state.queues.filter((q) => q.id !== queueId),
    selectedQueueId: state.selectedQueueId === queueId ? null : state.selectedQueueId,
  })),
  
  setSelectedQueueId: (id) => set({ selectedQueueId: id }),

  // Task actions
  setTasks: (tasks) => set({ tasks }),
  
  updateTask: (task) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
  })),
  
  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, task],
  })),
  
  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== taskId),
  })),

  // Event handlers from main process
  updateTaskProgress: (event) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === event.taskId
        ? { ...t, progress: event.progress, progressMessage: event.message }
        : t
    ),
  })),

  updateTaskStatus: (event) => set((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === event.taskId
        ? { ...t, status: event.status, error: event.error }
        : t
    ),
  })),

  updateQueueStatus: (event) => set((state) => ({
    queues: state.queues.map((q) =>
      q.id === event.queueId
        ? { ...q, status: event.status, currentTaskId: event.currentTaskId }
        : q
    ),
  })),

  // Loading states
  setLoadingQueues: (loading) => set({ isLoadingQueues: loading }),
  setLoadingTasks: (loading) => set({ isLoadingTasks: loading }),

  // UI actions
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
