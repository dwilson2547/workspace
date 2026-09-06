import { useState, useEffect, useCallback, useRef } from 'react';
import type { QueueInfo, TaskInfo, TaskProgress, TaskHistoryInfo, HistoryStats } from '../types';
import * as api from '../api';

// ============================================================================
// useQueues - Main queue state management
// ============================================================================

export function useQueues() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQueues = useCallback(async () => {
    try {
      const data = await api.getQueues();
      setQueues(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch queues');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced refresh to prevent excessive fetches during batch task completion
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchQueues();
    }, 500); // Wait 500ms after last task completion
  }, [fetchQueues]);

  useEffect(() => {
    fetchQueues();

    // Listen for queue status changes
    const unlistenStatus = api.onQueueStatusChanged((event) => {
      setQueues((prev) =>
        prev.map((q) =>
          q.id === event.queue_id ? { ...q, status: event.status } : q
        )
      );
    });

    // Listen for task completions to update counts (debounced)
    const unlistenCompleted = api.onTaskCompleted(() => {
      debouncedRefresh();
    });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      unlistenStatus.then((fn) => fn());
      unlistenCompleted.then((fn) => fn());
    };
  }, [fetchQueues, debouncedRefresh]);

  const createQueue = useCallback(async (name: string) => {
    const queue = await api.createQueue(name);
    setQueues((prev) => [queue, ...prev]);
    return queue;
  }, []);

  const deleteQueue = useCallback(async (id: string) => {
    await api.deleteQueue(id);
    setQueues((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const renameQueue = useCallback(async (id: string, name: string) => {
    await api.renameQueue(id, name);
    setQueues((prev) =>
      prev.map((q) => (q.id === id ? { ...q, name } : q))
    );
  }, []);

  const resumeQueue = useCallback(async (id: string) => {
    await api.resumeQueue(id);
    setQueues((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: 'running' } : q))
    );
  }, []);

  const pauseQueue = useCallback(async (id: string) => {
    await api.pauseQueue(id);
    setQueues((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: 'paused' } : q))
    );
  }, []);

  return {
    queues,
    loading,
    error,
    refresh: fetchQueues,
    createQueue,
    deleteQueue,
    renameQueue,
    resumeQueue,
    pauseQueue,
  };
}

// ============================================================================
// useTasks - Tasks for a specific queue
// ============================================================================

export function useTasks(queueId: string | null) {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!queueId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
      const data = await api.getQueueTasks(queueId);
      setTasks(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  // Debounced refresh
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchTasks();
    }, 500);
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();

    // Refresh on task completion (debounced)
    const unlisten = api.onTaskCompleted((event) => {
      if (event.queue_id === queueId) {
        debouncedRefresh();
      }
    });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      unlisten.then((fn) => fn());
    };
  }, [queueId, fetchTasks, debouncedRefresh]);

  const addTask = useCallback(
    async (taskType: string, config: any) => {
      if (!queueId) return;
      const task = await api.addTask(queueId, taskType, config);
      setTasks((prev) => [...prev, task]);
      return task;
    },
    [queueId]
  );

  const deleteTask = useCallback(async (taskId: string) => {
    await api.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const reorderTask = useCallback(
    async (taskId: string, newPosition: number) => {
      await api.reorderTask(taskId, newPosition);
      fetchTasks();
    },
    [fetchTasks]
  );

  return {
    tasks,
    loading,
    error,
    refresh: fetchTasks,
    addTask,
    deleteTask,
    reorderTask,
  };
}

// ============================================================================
// useTaskProgress - Real-time progress tracking
// ============================================================================

export function useTaskProgress() {
  const [progress, setProgress] = useState<Map<string, TaskProgress>>(new Map());
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unlisten = api.onTaskProgress((event) => {
      setProgress((prev) => {
        const next = new Map(prev);
        next.set(event.task_id, event);
        
        // Prevent unbounded growth - limit to 50 active progress entries
        if (next.size > 50) {
          const firstKey = next.keys().next().value;
          if (firstKey) next.delete(firstKey);
        }
        
        return next;
      });
    });

    const unlistenCompleted = api.onTaskCompleted((event) => {
      // Debounce deletion to batch multiple completions
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      
      cleanupTimerRef.current = setTimeout(() => {
        setProgress((prev) => {
          const next = new Map(prev);
          next.delete(event.task_id);
          return next;
        });
      }, 100);
    });

    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      unlisten.then((fn) => fn());
      unlistenCompleted.then((fn) => fn());
    };
  }, []);

  const getProgress = useCallback(
    (taskId: string) => progress.get(taskId),
    [progress]
  );

  return { progress, getProgress };
}

// ============================================================================
// useHistory - Task history
// ============================================================================

export function useHistory(limit = 50) {
  const [history, setHistory] = useState<TaskHistoryInfo[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [historyData, statsData] = await Promise.all([
        api.getHistory(limit),
        api.getHistoryStats(),
      ]);
      setHistory(historyData);
      setStats(statsData);
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Debounced refresh to prevent excessive DB queries
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchHistory();
    }, 1000); // Longer delay for history since it's less critical
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();

    // Refresh on task completion (debounced)
    const unlisten = api.onTaskCompleted(() => {
      debouncedRefresh();
    });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      unlisten.then((fn) => fn());
    };
  }, [fetchHistory, debouncedRefresh]);

  const clearHistory = useCallback(async () => {
    await api.clearHistory();
    setHistory([]);
    setStats({
      total_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
      total_bytes_processed: 0,
    });
  }, []);

  return { history, stats, loading, refresh: fetchHistory, clearHistory };
}

// ============================================================================
// useFfmpegStatus - Check FFmpeg availability
// ============================================================================

export function useFfmpegStatus() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [encoders, setEncoders] = useState<string[]>([]);

  useEffect(() => {
    async function check() {
      try {
        const [isAvailable, availableEncoders] = await Promise.all([
          api.checkFfmpeg(),
          api.getAvailableEncoders(),
        ]);
        setAvailable(isAvailable);
        setEncoders(availableEncoders);
      } catch {
        setAvailable(false);
        setEncoders([]);
      }
    }
    check();
  }, []);

  return { available, encoders };
}

// ============================================================================
// useDebounce - Debounce a value
// ============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// useInterval - Run callback at interval
// ============================================================================

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
