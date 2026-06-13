import { getDatabase, generateId, now } from '../index';
import type { Task, TaskType, TaskConfig, TaskStatus } from '@tqm/shared';

interface TaskRow {
  id: string;
  queue_id: string;
  type: string;
  config: string;
  status: string;
  progress: number;
  bytes_processed: number | null;
  total_bytes: number | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    queueId: row.queue_id,
    type: row.type as TaskType,
    config: JSON.parse(row.config) as TaskConfig,
    status: row.status as TaskStatus,
    progress: row.progress,
    bytesProcessed: row.bytes_processed ?? undefined,
    totalBytes: row.total_bytes ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

export function getTasks(queueId: string): Task[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM tasks WHERE queue_id = ? ORDER BY created_at DESC')
    .all(queueId) as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(id: string): Task | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function createTask(
  queueId: string,
  type: TaskType,
  config: TaskConfig
): Task {
  const db = getDatabase();
  const id = generateId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO tasks (id, queue_id, type, config, status, progress, created_at)
    VALUES (?, ?, ?, ?, 'pending', 0, ?)
  `).run(id, queueId, type, JSON.stringify(config), timestamp);

  return {
    id,
    queueId,
    type,
    config,
    status: 'pending',
    progress: 0,
    createdAt: timestamp,
  };
}

export function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'status' | 'progress' | 'bytesProcessed' | 'totalBytes' | 'error'>>
): Task {
  const db = getDatabase();
  const existing = getTask(id);
  if (!existing) {
    throw new Error(`Task not found: ${id}`);
  }

  const status = updates.status ?? existing.status;
  const progress = updates.progress ?? existing.progress;
  const bytesProcessed = updates.bytesProcessed ?? existing.bytesProcessed ?? null;
  const totalBytes = updates.totalBytes ?? existing.totalBytes ?? null;
  const error = updates.error ?? existing.error ?? null;

  let startedAt = existing.startedAt;
  let completedAt = existing.completedAt;

  // Set startedAt when task starts running
  if (status === 'running' && !startedAt) {
    startedAt = now();
  }

  // Set completedAt when task completes
  if (['completed', 'failed', 'cancelled'].includes(status) && !completedAt) {
    completedAt = now();
  }

  db.prepare(`
    UPDATE tasks
    SET status = ?, progress = ?, bytes_processed = ?, total_bytes = ?,
        error = ?, started_at = ?, completed_at = ?
    WHERE id = ?
  `).run(status, progress, bytesProcessed, totalBytes, error, startedAt ?? null, completedAt ?? null, id);

  return {
    ...existing,
    status,
    progress,
    bytesProcessed: bytesProcessed ?? undefined,
    totalBytes: totalBytes ?? undefined,
    error: error ?? undefined,
    startedAt,
    completedAt,
  };
}

export function cancelTask(id: string): Task {
  return updateTask(id, { status: 'cancelled' });
}

export function deleteTask(id: string): void {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`Task not found: ${id}`);
  }
}

export function getTasksByStatus(queueId: string, status: TaskStatus): Task[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM tasks WHERE queue_id = ? AND status = ? ORDER BY created_at')
    .all(queueId, status) as TaskRow[];
  return rows.map(rowToTask);
}

export function countTasks(queueId: string): { pending: number; running: number; total: number } {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
    FROM tasks WHERE queue_id = ?
  `).get(queueId) as { total: number; pending: number; running: number };
  return result;
}
