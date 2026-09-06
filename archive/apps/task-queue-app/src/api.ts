import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type {
  QueueInfo,
  TaskInfo,
  TaskHistoryInfo,
  HistoryStats,
  TaskConfig,
  TaskProgress,
  TaskCompleted,
  QueueStatusChanged,
} from './types';

// ============================================================================
// Queue API
// ============================================================================

export async function createQueue(name: string): Promise<QueueInfo> {
  return invoke('create_queue', { name });
}

export async function getQueues(): Promise<QueueInfo[]> {
  return invoke('get_queues');
}

export async function getQueue(queueId: string): Promise<QueueInfo> {
  return invoke('get_queue', { queueId });
}

export async function resumeQueue(queueId: string): Promise<void> {
  return invoke('resume_queue', { queueId });
}

export async function pauseQueue(queueId: string): Promise<void> {
  return invoke('pause_queue', { queueId });
}

export async function deleteQueue(queueId: string): Promise<void> {
  return invoke('delete_queue', { queueId });
}

export async function renameQueue(queueId: string, name: string): Promise<void> {
  return invoke('rename_queue', { queueId, name });
}

// ============================================================================
// Task API
// ============================================================================

export async function addTask(
  queueId: string,
  taskType: string,
  config: TaskConfig
): Promise<TaskInfo> {
  return invoke('add_task', { queueId, taskType, config });
}

export async function getQueueTasks(queueId: string): Promise<TaskInfo[]> {
  return invoke('get_queue_tasks', { queueId });
}

export async function deleteTask(taskId: string): Promise<void> {
  return invoke('delete_task', { taskId });
}

export async function reorderTask(taskId: string, newPosition: number): Promise<void> {
  return invoke('reorder_task', { taskId, newPosition });
}

// ============================================================================
// History API
// ============================================================================

export async function getHistory(limit?: number, offset?: number): Promise<TaskHistoryInfo[]> {
  return invoke('get_history', { limit, offset });
}

export async function getQueueHistory(queueId: string, limit?: number): Promise<TaskHistoryInfo[]> {
  return invoke('get_queue_history', { queueId, limit });
}

export async function clearHistory(): Promise<void> {
  return invoke('clear_history');
}

export async function getHistoryStats(): Promise<HistoryStats> {
  return invoke('get_history_stats');
}

// ============================================================================
// Utility API
// ============================================================================

export async function checkFfmpeg(): Promise<boolean> {
  return invoke('check_ffmpeg');
}

export async function getAvailableEncoders(): Promise<string[]> {
  return invoke('get_available_encoders');
}

export async function validateTaskConfig(taskType: string, config: TaskConfig): Promise<void> {
  return invoke('validate_task_config', { taskType, config });
}

// ============================================================================
// Event Listeners
// ============================================================================

export function onTaskProgress(callback: (progress: TaskProgress) => void): Promise<UnlistenFn> {
  return listen<TaskProgress>('task-progress', (event) => {
    callback(event.payload);
  });
}

export function onTaskCompleted(callback: (completed: TaskCompleted) => void): Promise<UnlistenFn> {
  return listen<TaskCompleted>('task-completed', (event) => {
    callback(event.payload);
  });
}

export function onQueueStatusChanged(
  callback: (status: QueueStatusChanged) => void
): Promise<UnlistenFn> {
  return listen<QueueStatusChanged>('queue-status-changed', (event) => {
    callback(event.payload);
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

export function getTaskTypeLabel(taskType: string): string {
  const labels: Record<string, string> = {
    copy: 'Copy',
    zip: 'Zip',
    tar: 'Tar',
    transcode: 'Transcode',
  };
  return labels[taskType] || taskType;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-gray-500',
    running: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
    cancelled: 'text-yellow-500',
    paused: 'text-gray-500',
  };
  return colors[status] || 'text-gray-500';
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100',
    running: 'bg-blue-100',
    completed: 'bg-green-100',
    failed: 'bg-red-100',
    cancelled: 'bg-yellow-100',
    paused: 'bg-gray-100',
  };
  return colors[status] || 'bg-gray-100';
}
