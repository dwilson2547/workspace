import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  Task,
  Workflow,
  WorkflowFile,
  WorkflowTask,
  WorkflowTaskStatus
} from '../src/shared/types';
import { runTask } from './taskRunner';
import {
  archiveWorkflowFile,
  getWorkflowById,
  updateWorkflowFileStatus,
  updateWorkflowStatus
} from './workflows';

const runningWorkflows = new Map<string, { cancelled: boolean }>();

const buildWorkflowTask = (template: WorkflowTask, filePath: string): Task => {
  const destinationDirectory = template.config?.destinationDirectory?.trim();
  const destinationPath = destinationDirectory
    ? path.join(destinationDirectory, path.basename(filePath))
    : undefined;

  return {
    id: randomUUID(),
    type: template.type,
    name: template.name,
    config: {
      sourcePath: filePath,
      destinationPath
    },
    status: 'pending',
    createdAt: new Date().toISOString()
  };
};

export const runWorkflow = async (workflowId: string) => {
  if (runningWorkflows.has(workflowId)) {
    return;
  }

  runningWorkflows.set(workflowId, { cancelled: false });
  updateWorkflowStatus(workflowId, 'running');

  const workflow = getWorkflowById(workflowId);
  if (!workflow) {
    runningWorkflows.delete(workflowId);
    return;
  }

  const pendingFiles = workflow.fileQueue.filter((file: WorkflowFile) => file.status === 'pending');
  const tasks = workflow.tasks;

  if (pendingFiles.length === 0 || tasks.length === 0) {
    updateWorkflowStatus(workflowId, 'idle');
    runningWorkflows.delete(workflowId);
    return;
  }

  const controller = runningWorkflows.get(workflowId)!;

  const processFile = async (file: WorkflowFile) => {
    if (controller.cancelled) {
      return;
    }
    const startedAt = new Date().toISOString();
    updateWorkflowFileStatus(file.id, 'processing', { startedAt, currentTaskIndex: 0 });
    const taskStatuses: WorkflowTaskStatus[] = [];

    for (let index = 0; index < tasks.length; index += 1) {
      if (controller.cancelled) {
        updateWorkflowFileStatus(file.id, 'pending', { currentTaskIndex: index });
        return;
      }
      updateWorkflowFileStatus(file.id, 'processing', { currentTaskIndex: index + 1 });
      const workflowTask = tasks[index];
      const task = buildWorkflowTask(workflowTask, file.filePath);
      const taskStartedAt = new Date().toISOString();
      try {
        await runTask(task as Task);
        const taskCompletedAt = new Date().toISOString();
        taskStatuses.push({
          taskId: workflowTask.id,
          name: workflowTask.name,
          type: workflowTask.type,
          order: workflowTask.order,
          status: 'completed',
          startedAt: taskStartedAt,
          completedAt: taskCompletedAt
        });
      } catch (error) {
        const completedAt = new Date().toISOString();
        const errorMessage = (error as Error).message;
        updateWorkflowFileStatus(file.id, 'failed', {
          error: errorMessage,
          completedAt,
          currentTaskIndex: index + 1
        });
        taskStatuses.push({
          taskId: workflowTask.id,
          name: workflowTask.name,
          type: workflowTask.type,
          order: workflowTask.order,
          status: 'failed',
          startedAt: taskStartedAt,
          completedAt,
          error: errorMessage
        });
        archiveWorkflowFile(
          workflowId,
          {
            ...file,
            status: 'failed',
            startedAt,
            completedAt,
            error: errorMessage,
            currentTaskIndex: index + 1
          },
          'failed',
          taskStatuses
        );
        return;
      }
    }

    const completedAt = new Date().toISOString();
    updateWorkflowFileStatus(file.id, 'completed', {
      completedAt,
      currentTaskIndex: tasks.length
    });
    archiveWorkflowFile(
      workflowId,
      {
        ...file,
        status: 'completed',
        startedAt,
        completedAt,
        currentTaskIndex: tasks.length
      },
      'completed',
      taskStatuses
    );
  };

  if (workflow.executionMode === 'parallel') {
    const maxParallel = Math.max(1, workflow.maxParallel ?? 2);
    const queue = [...pendingFiles];
    const workers = Array.from({ length: Math.min(maxParallel, queue.length) }).map(async () => {
      while (queue.length > 0 && !controller.cancelled) {
        const next = queue.shift();
        if (!next) {
          return;
        }
        await processFile(next);
      }
    });
    await Promise.all(workers);
  } else {
    for (const file of pendingFiles) {
      if (controller.cancelled) {
        break;
      }
      await processFile(file);
    }
  }

  if (controller.cancelled) {
    updateWorkflowStatus(workflowId, 'paused');
  } else {
    updateWorkflowStatus(workflowId, 'idle');
  }
  runningWorkflows.delete(workflowId);
};

export const pauseWorkflow = (workflowId: string) => {
  const controller = runningWorkflows.get(workflowId);
  if (controller) {
    controller.cancelled = true;
  }
  updateWorkflowStatus(workflowId, 'paused');
};
