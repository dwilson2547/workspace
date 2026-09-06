import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { Queue, Task, TaskHistory, TaskConfig, QueueType, QueueStatus, TaskStatus } from '../../shared/types';

let db: Database.Database | null = null;

export function initDatabase(): void {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'task-queue-manager.db');
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Better performance for concurrent reads
  
  createTables();
}

function createTables(): void {
  if (!db) throw new Error('Database not initialized');
  
  // Queues table
  db.exec(`
    CREATE TABLE IF NOT EXISTS queues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK (type IN ('queue', 'workflow')),
      status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('paused', 'running', 'idle')),
      current_task_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
      progress REAL NOT NULL DEFAULT 0,
      progress_message TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      task_order INTEGER NOT NULL,
      FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
    )
  `);
  
  // Task history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      queue_id TEXT NOT NULL,
      queue_name TEXT NOT NULL,
      task_name TEXT NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration INTEGER NOT NULL
    )
  `);
  
  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_queue_id ON tasks(queue_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(queue_id, task_order);
    CREATE INDEX IF NOT EXISTS idx_history_queue_id ON task_history(queue_id);
    CREATE INDEX IF NOT EXISTS idx_history_completed ON task_history(completed_at);
  `);
}

// Queue operations
export function createQueue(queue: Omit<Queue, 'createdAt' | 'updatedAt'>): Queue {
  if (!db) throw new Error('Database not initialized');
  
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO queues (id, name, description, type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(queue.id, queue.name, queue.description || null, queue.type, queue.status, now, now);
  
  return {
    ...queue,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateQueue(id: string, updates: Partial<Omit<Queue, 'id' | 'createdAt'>>): Queue | null {
  if (!db) throw new Error('Database not initialized');
  
  const queue = getQueue(id);
  if (!queue) return null;
  
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.currentTaskId !== undefined) {
    fields.push('current_task_id = ?');
    values.push(updates.currentTaskId);
  }
  
  values.push(id);
  
  const stmt = db.prepare(`UPDATE queues SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  
  return getQueue(id);
}

export function deleteQueue(id: string): boolean {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('DELETE FROM queues WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getQueue(id: string): Queue | null {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT * FROM queues WHERE id = ?');
  const row = stmt.get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as QueueType,
    status: row.status as QueueStatus,
    currentTaskId: row.current_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllQueues(): Queue[] {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT * FROM queues ORDER BY created_at DESC');
  const rows = stmt.all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as QueueType,
    status: row.status as QueueStatus,
    currentTaskId: row.current_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// Task operations
export function createTask(task: Omit<Task, 'createdAt' | 'order'>): Task {
  if (!db) throw new Error('Database not initialized');
  
  const now = new Date().toISOString();
  
  // Get the next order number
  const orderStmt = db.prepare('SELECT COALESCE(MAX(task_order), -1) + 1 as next_order FROM tasks WHERE queue_id = ?');
  const orderResult = orderStmt.get(task.queueId) as { next_order: number };
  const order = orderResult.next_order;
  
  const stmt = db.prepare(`
    INSERT INTO tasks (id, queue_id, name, config, status, progress, progress_message, error, created_at, task_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    task.id,
    task.queueId,
    task.name,
    JSON.stringify(task.config),
    task.status,
    task.progress,
    task.progressMessage || null,
    task.error || null,
    now,
    order
  );
  
  return {
    ...task,
    createdAt: now,
    order,
  };
}

export function updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'queueId' | 'createdAt'>>): Task | null {
  if (!db) throw new Error('Database not initialized');
  
  const task = getTask(id);
  if (!task) return null;
  
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.config !== undefined) {
    fields.push('config = ?');
    values.push(JSON.stringify(updates.config));
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(updates.progress);
  }
  if (updates.progressMessage !== undefined) {
    fields.push('progress_message = ?');
    values.push(updates.progressMessage);
  }
  if (updates.error !== undefined) {
    fields.push('error = ?');
    values.push(updates.error);
  }
  if (updates.startedAt !== undefined) {
    fields.push('started_at = ?');
    values.push(updates.startedAt);
  }
  if (updates.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(updates.completedAt);
  }
  if (updates.order !== undefined) {
    fields.push('task_order = ?');
    values.push(updates.order);
  }
  
  if (fields.length === 0) return task;
  
  values.push(id);
  
  const stmt = db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  
  return getTask(id);
}

export function deleteTask(id: string): boolean {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getTask(id: string): Task | null {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const row = stmt.get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    queueId: row.queue_id,
    name: row.name,
    config: JSON.parse(row.config) as TaskConfig,
    status: row.status as TaskStatus,
    progress: row.progress,
    progressMessage: row.progress_message,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    order: row.task_order,
  };
}

export function getTasksByQueue(queueId: string): Task[] {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT * FROM tasks WHERE queue_id = ? ORDER BY task_order ASC');
  const rows = stmt.all(queueId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    queueId: row.queue_id,
    name: row.name,
    config: JSON.parse(row.config) as TaskConfig,
    status: row.status as TaskStatus,
    progress: row.progress,
    progressMessage: row.progress_message,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    order: row.task_order,
  }));
}

export function reorderTasks(queueId: string, taskIds: string[]): void {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('UPDATE tasks SET task_order = ? WHERE id = ? AND queue_id = ?');
  
  const transaction = db.transaction(() => {
    taskIds.forEach((taskId, index) => {
      stmt.run(index, taskId, queueId);
    });
  });
  
  transaction();
}

export function resetWorkflowTasks(queueId: string): void {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare(`
    UPDATE tasks 
    SET status = 'pending', progress = 0, progress_message = NULL, error = NULL, started_at = NULL, completed_at = NULL
    WHERE queue_id = ?
  `);
  
  stmt.run(queueId);
}

// History operations
export function createHistory(history: TaskHistory): TaskHistory {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare(`
    INSERT INTO task_history (id, task_id, queue_id, queue_name, task_name, config, status, error, started_at, completed_at, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    history.id,
    history.taskId,
    history.queueId,
    history.queueName,
    history.taskName,
    JSON.stringify(history.config),
    history.status,
    history.error || null,
    history.startedAt,
    history.completedAt,
    history.duration
  );
  
  return history;
}

export function getAllHistory(limit: number = 100): TaskHistory[] {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT * FROM task_history ORDER BY completed_at DESC LIMIT ?');
  const rows = stmt.all(limit) as any[];
  
  return rows.map(row => ({
    id: row.id,
    taskId: row.task_id,
    queueId: row.queue_id,
    queueName: row.queue_name,
    taskName: row.task_name,
    config: JSON.parse(row.config) as TaskConfig,
    status: row.status as TaskStatus,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    duration: row.duration,
  }));
}

export function getHistoryByQueue(queueId: string, limit: number = 50): TaskHistory[] {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT * FROM task_history WHERE queue_id = ? ORDER BY completed_at DESC LIMIT ?');
  const rows = stmt.all(queueId, limit) as any[];
  
  return rows.map(row => ({
    id: row.id,
    taskId: row.task_id,
    queueId: row.queue_id,
    queueName: row.queue_name,
    taskName: row.task_name,
    config: JSON.parse(row.config) as TaskConfig,
    status: row.status as TaskStatus,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    duration: row.duration,
  }));
}

export function clearHistory(beforeDate?: string): number {
  if (!db) throw new Error('Database not initialized');
  
  let stmt;
  if (beforeDate) {
    stmt = db.prepare('DELETE FROM task_history WHERE completed_at < ?');
    return stmt.run(beforeDate).changes;
  } else {
    stmt = db.prepare('DELETE FROM task_history');
    return stmt.run().changes;
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
