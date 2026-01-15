import { randomUUID } from 'node:crypto';
import type { Queue, Task, TaskConfig, TaskType } from '../src/shared/types';
import { getDatabase } from './db';

const serializeTask = (task: Task) => ({
  ...task,
  config: JSON.stringify(task.config)
});

const deserializeTask = (row: any): Task => ({
  id: row.id,
  type: row.type as TaskType,
  name: row.name,
  config: JSON.parse(row.config) as TaskConfig,
  status: row.status,
  progress: row.progress ?? undefined,
  error: row.error ?? undefined,
  createdAt: row.created_at,
  startedAt: row.started_at ?? undefined,
  completedAt: row.completed_at ?? undefined
});

export const listQueues = (): Queue[] => {
  const db = getDatabase();
  const queueRows = db.prepare('SELECT * FROM queues ORDER BY created_at ASC').all();

  return queueRows.map((queueRow: any) => {
    const taskRows = db
      .prepare('SELECT * FROM tasks WHERE queue_id = ? ORDER BY task_order ASC')
      .all(queueRow.id);

    return {
      id: queueRow.id,
      name: queueRow.name,
      description: queueRow.description ?? undefined,
      status: queueRow.status,
      currentTaskIndex: queueRow.current_task_index ?? 0,
      createdAt: queueRow.created_at,
      updatedAt: queueRow.updated_at,
      tasks: taskRows.map(deserializeTask)
    } as Queue;
  });
};

export const createQueue = (name: string): Queue => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const queue: Queue = {
    id: randomUUID(),
    name,
    description: undefined,
    status: 'paused',
    currentTaskIndex: 0,
    createdAt: now,
    updatedAt: now,
    tasks: []
  };

  db.prepare(
    'INSERT INTO queues (id, name, description, status, current_task_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(queue.id, queue.name, queue.description ?? null, queue.status, queue.currentTaskIndex, queue.createdAt, queue.updatedAt);

  return queue;
};

export const addTaskToQueue = (
  queueId: string,
  taskData: { name: string; type: TaskType; config: TaskConfig }
): Task => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    name: taskData.name,
    type: taskData.type,
    config: taskData.config,
    status: 'pending',
    createdAt: now
  };

  const nextOrder =
    (db
      .prepare('SELECT COALESCE(MAX(task_order), -1) as maxOrder FROM tasks WHERE queue_id = ?')
      .get(queueId) as { maxOrder: number }).maxOrder + 1;

  const serialized = serializeTask(task);

  db.prepare(
    `INSERT INTO tasks (id, queue_id, type, name, config, status, progress, error, task_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    serialized.id,
    queueId,
    serialized.type,
    serialized.name,
    serialized.config,
    serialized.status,
    serialized.progress ?? null,
    serialized.error ?? null,
    nextOrder,
    serialized.createdAt
  );

  db.prepare('UPDATE queues SET updated_at = ? WHERE id = ?').run(now, queueId);

  return task;
};

export const updateQueueStatus = (queueId: string, status: Queue['status']) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE queues SET status = ?, updated_at = ? WHERE id = ?').run(status, now, queueId);
};

export const updateTaskStatus = (
  taskId: string,
  status: Task['status'],
  extra?: { error?: string; startedAt?: string; completedAt?: string }
) => {
  const db = getDatabase();
  db.prepare(
    'UPDATE tasks SET status = ?, error = ?, started_at = ?, completed_at = ? WHERE id = ?'
  ).run(status, extra?.error ?? null, extra?.startedAt ?? null, extra?.completedAt ?? null, taskId);
};

export const updateQueueCurrentIndex = (queueId: string, index: number) => {
  const db = getDatabase();
  db.prepare('UPDATE queues SET current_task_index = ? WHERE id = ?').run(index, queueId);
};
