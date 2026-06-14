import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations } from './migrations';

let db: Database.Database | null = null;

/**
 * Initialize the database connection
 * @param dbPath Path to the SQLite database file
 */
export function initDatabase(dbPath: string): Database.Database {
  if (db) {
    return db;
  }

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  const fs = require('fs');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Create database connection
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');

  // Run migrations
  runMigrations(db);

  return db;
}

/**
 * Get the database instance
 * @throws Error if database is not initialized
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Generate a new UUID
 */
export function generateId(): string {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

/**
 * Get current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}
