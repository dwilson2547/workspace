import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../database';
import { getExecutor, CancellationToken, ExecutorProgress } from '../executors';
import {
  Queue,
  Task,
  TaskHistory,
  QueueStatus,
  TaskStatus,
  IPC_CHANNELS,
  TaskProgressEvent,
  TaskStatusEvent,
  QueueStatusEvent,
} from '../../shared/types';

interface RunningQueue {
  queueId: string;
  cancellationToken: CancellationToken;
  currentTaskId: string | null;
}

class QueueService {
  private runningQueues: Map<string, RunningQueue> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private isPaused: boolean = false; // Global pause for sleep/wake handling

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  // Handle system sleep - pause all running queues gracefully
  handleSystemSleep(): void {
    console.log('System going to sleep, pausing all queues...');
    this.isPaused = true;
    
    // Mark all running queues to stop after current task
    for (const [queueId, running] of this.runningQueues) {
      running.cancellationToken.cancelled = true;
    }
  }

  // Handle system wake - resume processing
  handleSystemWake(): void {
    console.log('System waking up, resuming queues...');
    this.isPaused = false;
    
    // Re-check all queues that should be running
    const queues = db.getAllQueues();
    for (const queue of queues) {
      if (queue.status === 'running' && !this.runningQueues.has(queue.id)) {
        this.processQueue(queue.id);
      }
    }
  }

  // Start processing a queue
  async startQueue(queueId: string): Promise<Queue | null> {
    const queue = db.getQueue(queueId);
    if (!queue) return null;

    // Already running?
    if (this.runningQueues.has(queueId)) {
      return queue;
    }

    // Update status
    const updated = db.updateQueue(queueId, { status: 'running' });
    this.emitQueueStatus(queueId, 'running');

    // Start processing
    this.processQueue(queueId);

    return updated;
  }

  // Pause a queue (waits for current task to complete)
  async pauseQueue(queueId: string): Promise<Queue | null> {
    const queue = db.getQueue(queueId);
    if (!queue) return null;

    const running = this.runningQueues.get(queueId);
    if (running) {
      // Signal to stop after current task
      running.cancellationToken.cancelled = true;
    }

    // Update status
    const updated = db.updateQueue(queueId, { status: 'paused' });
    this.emitQueueStatus(queueId, 'paused');

    return updated;
  }

  // Cancel the current task in a queue
  cancelCurrentTask(queueId: string): boolean {
    const running = this.runningQueues.get(queueId);
    if (running && running.currentTaskId) {
      running.cancellationToken.cancelled = true;
      return true;
    }
    return false;
  }

  // Reset a workflow (set all tasks back to pending)
  resetWorkflow(queueId: string): Queue | null {
    const queue = db.getQueue(queueId);
    if (!queue || queue.type !== 'workflow') return null;

    // Must be paused to reset
    if (this.runningQueues.has(queueId)) {
      return null;
    }

    db.resetWorkflowTasks(queueId);
    db.updateQueue(queueId, { status: 'paused', currentTaskId: undefined });

    return db.getQueue(queueId);
  }

  // Main queue processing loop
  private async processQueue(queueId: string): Promise<void> {
    const cancellationToken: CancellationToken = { cancelled: false };
    const running: RunningQueue = {
      queueId,
      cancellationToken,
      currentTaskId: null,
    };
    this.runningQueues.set(queueId, running);

    try {
      while (!cancellationToken.cancelled && !this.isPaused) {
        // Get next pending task
        const tasks = db.getTasksByQueue(queueId);
        const nextTask = tasks.find(t => t.status === 'pending');

        if (!nextTask) {
          // No more tasks - queue is idle
          const queue = db.getQueue(queueId);
          
          if (queue?.type === 'workflow') {
            // Workflow complete - pause it
            db.updateQueue(queueId, { status: 'paused', currentTaskId: undefined });
            this.emitQueueStatus(queueId, 'paused');
          } else {
            // Regular queue - set to idle
            db.updateQueue(queueId, { status: 'idle', currentTaskId: undefined });
            this.emitQueueStatus(queueId, 'idle');
          }
          break;
        }

        // Execute the task
        running.currentTaskId = nextTask.id;
        db.updateQueue(queueId, { currentTaskId: nextTask.id });
        
        await this.executeTask(nextTask, cancellationToken);
        
        running.currentTaskId = null;
      }
    } finally {
      this.runningQueues.delete(queueId);
      
      // If we stopped due to cancellation (pause), update status
      if (cancellationToken.cancelled) {
        db.updateQueue(queueId, { status: 'paused', currentTaskId: undefined });
        this.emitQueueStatus(queueId, 'paused');
      }
    }
  }

  private async executeTask(task: Task, cancellationToken: CancellationToken): Promise<void> {
    const startTime = new Date();
    
    // Update task status to running
    db.updateTask(task.id, { 
      status: 'running', 
      startedAt: startTime.toISOString(),
      progress: 0,
      error: undefined,
    });
    this.emitTaskStatus(task.id, task.queueId, 'running');

    // Get executor
    const executor = getExecutor(task.config.type);

    // Progress callback
    const onProgress = (progress: ExecutorProgress) => {
      db.updateTask(task.id, {
        progress: progress.progress,
        progressMessage: progress.message,
      });
      this.emitTaskProgress(task.id, task.queueId, progress.progress, progress.message);
    };

    try {
      // Execute the task
      const result = await executor.execute(task.config, onProgress, cancellationToken);
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const queue = db.getQueue(task.queueId);

      if (result.success) {
        // Task completed successfully
        db.updateTask(task.id, {
          status: 'completed',
          completedAt: endTime.toISOString(),
          progress: 100,
          error: undefined,
        });
        this.emitTaskStatus(task.id, task.queueId, 'completed');

        // Add to history
        this.addToHistory(task, queue!, 'completed', undefined, startTime, endTime, duration);

        // For regular queues, we could optionally delete completed tasks
        // For now, keep them for visibility
      } else if (cancellationToken.cancelled) {
        // Task was cancelled
        db.updateTask(task.id, {
          status: 'cancelled',
          completedAt: endTime.toISOString(),
          error: result.error || 'Task cancelled',
        });
        this.emitTaskStatus(task.id, task.queueId, 'cancelled', result.error);

        // Add to history
        this.addToHistory(task, queue!, 'cancelled', result.error, startTime, endTime, duration);
      } else {
        // Task failed
        db.updateTask(task.id, {
          status: 'failed',
          completedAt: endTime.toISOString(),
          error: result.error,
        });
        this.emitTaskStatus(task.id, task.queueId, 'failed', result.error);

        // Add to history
        this.addToHistory(task, queue!, 'failed', result.error, startTime, endTime, duration);
      }
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const errorMessage = error.message || String(error);
      const queue = db.getQueue(task.queueId);

      db.updateTask(task.id, {
        status: 'failed',
        completedAt: endTime.toISOString(),
        error: errorMessage,
      });
      this.emitTaskStatus(task.id, task.queueId, 'failed', errorMessage);

      // Add to history
      this.addToHistory(task, queue!, 'failed', errorMessage, startTime, endTime, duration);
    }
  }

  private addToHistory(
    task: Task,
    queue: Queue,
    status: TaskStatus,
    error: string | undefined,
    startedAt: Date,
    completedAt: Date,
    duration: number
  ): void {
    const history: TaskHistory = {
      id: uuidv4(),
      taskId: task.id,
      queueId: task.queueId,
      queueName: queue.name,
      taskName: task.name,
      config: task.config,
      status,
      error,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      duration,
    };

    db.createHistory(history);
  }

  // IPC event emitters
  private emitTaskProgress(taskId: string, queueId: string, progress: number, message?: string): void {
    if (this.mainWindow) {
      const event: TaskProgressEvent = { taskId, queueId, progress, message };
      this.mainWindow.webContents.send(IPC_CHANNELS.TASK_PROGRESS, event);
    }
  }

  private emitTaskStatus(taskId: string, queueId: string, status: TaskStatus, error?: string): void {
    if (this.mainWindow) {
      const event: TaskStatusEvent = { taskId, queueId, status, error };
      this.mainWindow.webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGED, event);
    }
  }

  private emitQueueStatus(queueId: string, status: QueueStatus, currentTaskId?: string): void {
    if (this.mainWindow) {
      const event: QueueStatusEvent = { queueId, status, currentTaskId };
      this.mainWindow.webContents.send(IPC_CHANNELS.QUEUE_STATUS_CHANGED, event);
    }
  }
}

// Singleton instance
export const queueService = new QueueService();
