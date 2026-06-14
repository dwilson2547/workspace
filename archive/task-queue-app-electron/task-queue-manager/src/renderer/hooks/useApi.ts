import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../stores/appStore';
import { Queue, Task, TaskConfig, QueueType, TaskHistory } from '@shared/types';

// Helper to get the electron API
const api = () => window.electronAPI;

// ============ Event Listeners ============

export function useElectronEvents() {
  const { updateTaskProgress, updateTaskStatus, updateQueueStatus } = useAppStore();

  useEffect(() => {
    // Set up event listeners
    const unsubProgress = api().on.taskProgress(updateTaskProgress);
    const unsubTaskStatus = api().on.taskStatusChanged(updateTaskStatus);
    const unsubQueueStatus = api().on.queueStatusChanged(updateQueueStatus);

    // Cleanup on unmount
    return () => {
      unsubProgress();
      unsubTaskStatus();
      unsubQueueStatus();
    };
  }, [updateTaskProgress, updateTaskStatus, updateQueueStatus]);
}

// ============ Queue Hooks ============

export function useQueues() {
  const { setQueues, setLoadingQueues } = useAppStore();
  
  return useQuery({
    queryKey: ['queues'],
    queryFn: async () => {
      setLoadingQueues(true);
      const response = await api().queue.getAll();
      setLoadingQueues(false);
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      setQueues(response.data!);
      return response.data!;
    },
  });
}

export function useQueue(id: string | null) {
  return useQuery({
    queryKey: ['queue', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api().queue.get(id);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    enabled: !!id,
  });
}

export function useCreateQueue() {
  const queryClient = useQueryClient();
  const { addQueue } = useAppStore();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; type: QueueType }) => {
      const response = await api().queue.create(data);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: (queue) => {
      addQueue(queue);
      queryClient.invalidateQueries({ queryKey: ['queues'] });
    },
  });
}

export function useUpdateQueue() {
  const queryClient = useQueryClient();
  const { updateQueue } = useAppStore();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Queue> }) => {
      const response = await api().queue.update(id, updates);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: (queue) => {
      updateQueue(queue);
      queryClient.invalidateQueries({ queryKey: ['queues'] });
    },
  });
}

export function useDeleteQueue() {
  const queryClient = useQueryClient();
  const { removeQueue } = useAppStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api().queue.delete(id);
      if (!response.success) {
        throw new Error(response.error);
      }
      return id;
    },
    onSuccess: (id) => {
      removeQueue(id);
      queryClient.invalidateQueries({ queryKey: ['queues'] });
    },
  });
}

export function useStartQueue() {
  const { updateQueue } = useAppStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api().queue.start(id);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: (queue) => {
      updateQueue(queue);
    },
  });
}

export function usePauseQueue() {
  const { updateQueue } = useAppStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api().queue.pause(id);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: (queue) => {
      updateQueue(queue);
    },
  });
}

export function useResetWorkflow() {
  const queryClient = useQueryClient();
  const { updateQueue, setTasks } = useAppStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api().queue.reset(id);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: (queue) => {
      updateQueue(queue);
      // Refresh tasks
      queryClient.invalidateQueries({ queryKey: ['tasks', queue.id] });
    },
  });
}

// ============ Task Hooks ============

export function useTasks(queueId: string | null) {
  const { setTasks, setLoadingTasks } = useAppStore();

  return useQuery({
    queryKey: ['tasks', queueId],
    queryFn: async () => {
      if (!queueId) return [];
      
      setLoadingTasks(true);
      const response = await api().task.getAll(queueId);
      setLoadingTasks(false);
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      setTasks(response.data!);
      return response.data!;
    },
    enabled: !!queueId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { addTask } = useAppStore();

  return useMutation({
    mutationFn: async (data: { queueId: string; name: string; config: TaskConfig }) => {
      const response = await api().task.create(data);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: (task) => {
      addTask(task);
      queryClient.invalidateQueries({ queryKey: ['tasks', task.queueId] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { updateTask } = useAppStore();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const response = await api().task.update(id, updates);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: (task) => {
      updateTask(task);
      queryClient.invalidateQueries({ queryKey: ['tasks', task.queueId] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { removeTask, selectedQueueId } = useAppStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api().task.delete(id);
      if (!response.success) {
        throw new Error(response.error);
      }
      return id;
    },
    onSuccess: (id) => {
      removeTask(id);
      queryClient.invalidateQueries({ queryKey: ['tasks', selectedQueueId] });
    },
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ queueId, taskIds }: { queueId: string; taskIds: string[] }) => {
      const response = await api().task.reorder(queueId, taskIds);
      if (!response.success) {
        throw new Error(response.error);
      }
      return { queueId, taskIds };
    },
    onSuccess: ({ queueId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', queueId] });
    },
  });
}

export function useCancelTask() {
  return useMutation({
    mutationFn: async (queueId: string) => {
      const response = await api().task.cancel(queueId);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
  });
}

// ============ History Hooks ============

export function useHistory(limit?: number) {
  return useQuery({
    queryKey: ['history', limit],
    queryFn: async () => {
      const response = await api().history.getAll(limit);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
  });
}

export function useQueueHistory(queueId: string | null, limit?: number) {
  return useQuery({
    queryKey: ['history', 'queue', queueId, limit],
    queryFn: async () => {
      if (!queueId) return [];
      const response = await api().history.getByQueue(queueId, limit);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    enabled: !!queueId,
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (beforeDate?: string) => {
      const response = await api().history.clear(beforeDate);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

// ============ Dialog Hooks ============

export function useFileDialog() {
  const selectFile = useCallback(async (options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    multiple?: boolean;
  }) => {
    const response = await api().dialog.selectFile(options);
    if (!response.success) {
      throw new Error(response.error);
    }
    return response.data!;
  }, []);

  const selectDirectory = useCallback(async (options?: {
    title?: string;
    multiple?: boolean;
  }) => {
    const response = await api().dialog.selectDirectory(options);
    if (!response.success) {
      throw new Error(response.error);
    }
    return response.data!;
  }, []);

  const selectSave = useCallback(async (options?: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => {
    const response = await api().dialog.selectSave(options);
    if (!response.success) {
      throw new Error(response.error);
    }
    return response.data!;
  }, []);

  return { selectFile, selectDirectory, selectSave };
}
