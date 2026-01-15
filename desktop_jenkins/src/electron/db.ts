import path from 'node:path';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { app } from 'electron';

let db: DatabaseType | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS queues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    current_task_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    queue_id TEXT,
    workflow_id TEXT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER,
    error TEXT,
    task_order INTEGER,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS task_history (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT NOT NULL,
    progress INTEGER,
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
  )`
];

export const initDatabase = () => {
  if (db) {
    return db;
  }
  const dbPath = path.join(app.getPath('userData'), 'taskmanager.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  schemaStatements.forEach((statement) => db!.prepare(statement).run());
  return db;
};

export const getDatabase = () => {
  if (!db) {
    return initDatabase();
  }
  return db;
};
