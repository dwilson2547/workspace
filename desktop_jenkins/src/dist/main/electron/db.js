"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = exports.initDatabase = void 0;
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const electron_1 = require("electron");
let db = null;
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
  )`
];
const initDatabase = () => {
    if (db) {
        return db;
    }
    const dbPath = node_path_1.default.join(electron_1.app.getPath('userData'), 'taskmanager.db');
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL');
    schemaStatements.forEach((statement) => db.prepare(statement).run());
    return db;
};
exports.initDatabase = initDatabase;
const getDatabase = () => {
    if (!db) {
        return (0, exports.initDatabase)();
    }
    return db;
};
exports.getDatabase = getDatabase;
