import { getDatabase, generateId, now } from '../index';
import type { Queue, QueueStatus } from '@tqm/shared';

interface QueueRow {
  id: string;
  name: string;
  status: string;
  max_parallel: number;
  created_at: string;
  updated_at: string;
}

function rowToQueue(row: QueueRow): Queue {
  return {
    id: row.id,
    name: row.name,
    status: row.status as QueueStatus,
    maxParallel: row.max_parallel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getQueues(): Queue[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM queues ORDER BY created_at DESC').all() as QueueRow[];
  return rows.map(rowToQueue);
}

export function getQueue(id: string): Queue | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM queues WHERE id = ?').get(id) as QueueRow | undefined;
  return row ? rowToQueue(row) : null;
}

export function createQueue(name: string, maxParallel: number = 1): Queue {
  const db = getDatabase();
  const id = generateId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO queues (id, name, status, max_parallel, created_at, updated_at)
    VALUES (?, ?, 'idle', ?, ?, ?)
  `).run(id, name, maxParallel, timestamp, timestamp);

  return {
    id,
    name,
    status: 'idle',
    maxParallel,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateQueue(
  id: string,
  updates: Partial<Pick<Queue, 'name' | 'status' | 'maxParallel'>>
): Queue {
  const db = getDatabase();
  const existing = getQueue(id);
  if (!existing) {
    throw new Error(`Queue not found: ${id}`);
  }

  const timestamp = now();
  const name = updates.name ?? existing.name;
  const status = updates.status ?? existing.status;
  const maxParallel = updates.maxParallel ?? existing.maxParallel;

  db.prepare(`
    UPDATE queues
    SET name = ?, status = ?, max_parallel = ?, updated_at = ?
    WHERE id = ?
  `).run(name, status, maxParallel, timestamp, id);

  return {
    ...existing,
    name,
    status,
    maxParallel,
    updatedAt: timestamp,
  };
}

export function deleteQueue(id: string): void {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM queues WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`Queue not found: ${id}`);
  }
}

export function startQueue(id: string): Queue {
  return updateQueue(id, { status: 'running' });
}

export function pauseQueue(id: string): Queue {
  return updateQueue(id, { status: 'paused' });
}
