import type Database from 'better-sqlite3';
import { DEFAULT_APP_SETTINGS } from '@tqm/shared';

/**
 * Run all database migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);

  const migrations: Array<{ name: string; up: () => void }> = [
    { name: '001_initial_schema', up: () => migration001(db) },
    { name: '002_app_settings', up: () => migration002(db) },
  ];

  const appliedMigrations = db
    .prepare('SELECT name FROM migrations')
    .all()
    .map((row: { name: string }) => row.name);

  for (const migration of migrations) {
    if (!appliedMigrations.includes(migration.name)) {
      console.log(`Running migration: ${migration.name}`);
      migration.up();
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
        migration.name,
        new Date().toISOString()
      );
    }
  }
}

/**
 * Migration 001: Initial schema
 */
function migration001(db: Database.Database): void {
  db.exec(`
    -- Queues table
    CREATE TABLE IF NOT EXISTS queues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      max_parallel INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      bytes_processed INTEGER,
      total_bytes INTEGER,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_queue_id ON tasks(queue_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    -- Workflows table
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      trigger_type TEXT NOT NULL,
      trigger_path TEXT,
      trigger_pattern TEXT,
      trigger_recursive INTEGER DEFAULT 0,
      trigger_max_depth INTEGER,
      trigger_process_existing INTEGER DEFAULT 0,
      trigger_newer_than TEXT,
      execution_mode TEXT NOT NULL DEFAULT 'sequential',
      execution_max_parallel INTEGER DEFAULT 1,
      output_directory TEXT,
      output_name_template TEXT,
      recovery_interrupted TEXT DEFAULT 'ask',
      recovery_check_missed INTEGER DEFAULT 1,
      watch_ignore_temp INTEGER DEFAULT 1,
      watch_temp_patterns TEXT,
      watch_ignore_hidden INTEGER DEFAULT 1,
      watch_min_file_size INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Workflow task definitions
    CREATE TABLE IF NOT EXISTS workflow_tasks (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      task_type TEXT NOT NULL,
      config TEXT NOT NULL,
      on_error TEXT NOT NULL DEFAULT 'fail_file',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflow_id ON workflow_tasks(workflow_id);

    -- Workflow files (files being processed)
    CREATE TABLE IF NOT EXISTS workflow_files (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      source_path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      added_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_files_workflow_id ON workflow_files(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_files_status ON workflow_files(status);

    -- Workflow file task statuses
    CREATE TABLE IF NOT EXISTS workflow_file_tasks (
      id TEXT PRIMARY KEY,
      workflow_file_id TEXT NOT NULL REFERENCES workflow_files(id) ON DELETE CASCADE,
      workflow_task_id TEXT NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      bytes_processed INTEGER,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_file_tasks_file_id ON workflow_file_tasks(workflow_file_id);

    -- Processed files history (for deduplication)
    CREATE TABLE IF NOT EXISTS workflow_processed_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      file_hash TEXT,
      processed_at TEXT NOT NULL,
      UNIQUE(workflow_id, file_path)
    );
    CREATE INDEX IF NOT EXISTS idx_processed_files_workflow ON workflow_processed_files(workflow_id);

    -- Task templates
    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      base_task TEXT NOT NULL,
      config TEXT NOT NULL,
      locked_fields TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- User contexts (for download task)
    CREATE TABLE IF NOT EXISTS user_contexts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_built_in INTEGER NOT NULL DEFAULT 0,
      headers TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Header presets (for download task)
    CREATE TABLE IF NOT EXISTS header_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      headers TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Dependencies cache
    CREATE TABLE IF NOT EXISTS dependencies (
      name TEXT PRIMARY KEY,
      available INTEGER NOT NULL DEFAULT 0,
      version TEXT,
      checked_at TEXT NOT NULL
    );
  `);
}

/**
 * Migration 002: App settings
 */
function migration002(db: Database.Database): void {
  db.exec(`
    -- App settings (singleton table)
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      pause_all_on_startup INTEGER NOT NULL DEFAULT 0,
      theme TEXT NOT NULL DEFAULT 'system',
      download_defaults TEXT NOT NULL
    );
  `);

  // Insert default settings if not exists
  const exists = db.prepare('SELECT id FROM app_settings WHERE id = 1').get();
  if (!exists) {
    db.prepare(`
      INSERT INTO app_settings (id, pause_all_on_startup, theme, download_defaults)
      VALUES (1, ?, ?, ?)
    `).run(
      DEFAULT_APP_SETTINGS.pauseAllOnStartup ? 1 : 0,
      DEFAULT_APP_SETTINGS.theme,
      JSON.stringify(DEFAULT_APP_SETTINGS.downloadDefaults)
    );
  }

  // Insert built-in user contexts
  const builtInContexts = [
    {
      id: 'chrome-windows',
      name: 'Chrome (Windows)',
      description: 'Chrome 120 on Windows 11',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
      },
    },
    {
      id: 'chrome-macos',
      name: 'Chrome (macOS)',
      description: 'Chrome 120 on macOS',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    },
    {
      id: 'firefox-windows',
      name: 'Firefox (Windows)',
      description: 'Firefox 121 on Windows',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    },
    {
      id: 'curl',
      name: 'curl',
      description: 'Minimal headers like command-line curl',
      headers: {
        'User-Agent': 'curl/8.4.0',
        'Accept': '*/*',
      },
    },
  ];

  const insertContext = db.prepare(`
    INSERT OR IGNORE INTO user_contexts (id, name, description, is_built_in, headers, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?)
  `);

  const timestamp = new Date().toISOString();
  for (const ctx of builtInContexts) {
    insertContext.run(
      ctx.id,
      ctx.name,
      ctx.description,
      JSON.stringify(ctx.headers),
      timestamp,
      timestamp
    );
  }
}
