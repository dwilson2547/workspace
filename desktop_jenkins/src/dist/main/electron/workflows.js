"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearWorkflowHistory = exports.removeWorkflowHistoryItem = exports.removeWorkflowFile = exports.updateWorkflowFileStatus = exports.updateWorkflowStatus = exports.archiveWorkflowFile = exports.recordProcessedFile = exports.hasProcessedFile = exports.getWorkflowById = exports.updateWorkflowWatcherConfig = exports.updateWorkflowSettings = exports.addWorkflowFolder = exports.addWorkflowFiles = exports.removeWorkflowTask = exports.addWorkflowTask = exports.createWorkflow = exports.listWorkflows = void 0;
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const defaultWatcherConfig = {
    enabled: false,
    watchPath: '',
    recursive: false,
    filters: {
        extensions: undefined,
        filenamePattern: undefined,
        ignoreHidden: true,
        minSize: undefined
    },
    ignoreExisting: true,
    stabilityDelay: 3000,
    pollInterval: undefined
};
const normalizeWatcherConfig = (value) => {
    if (!value) {
        return { ...defaultWatcherConfig };
    }
    try {
        const parsed = JSON.parse(value);
        return {
            ...defaultWatcherConfig,
            ...parsed,
            filters: {
                ...defaultWatcherConfig.filters,
                ...(parsed.filters ?? {})
            }
        };
    }
    catch {
        return { ...defaultWatcherConfig };
    }
};
const serializeWorkflowTask = (task) => ({
    ...task,
    config: JSON.stringify(task.config)
});
const deserializeWorkflowTask = (row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    config: JSON.parse(row.config),
    order: row.task_order ?? 0,
    createdAt: row.created_at
});
const deserializeWorkflowFile = (row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    filePath: row.file_path,
    status: row.status,
    currentTaskIndex: row.current_task_index ?? 0,
    error: row.error ?? undefined,
    addedAt: row.added_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined
});
const deserializeWorkflowHistory = (row) => ({
    id: row.id,
    workflowId: row.workflow_id,
    filePath: row.file_path,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    taskStatuses: JSON.parse(row.task_statuses)
});
const listWorkflows = () => {
    const db = (0, db_1.getDatabase)();
    const workflowRows = db.prepare('SELECT * FROM workflows ORDER BY created_at ASC').all();
    return workflowRows.map((workflowRow) => {
        const taskRows = db
            .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
            .all(workflowRow.id);
        const fileRows = db
            .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
            .all(workflowRow.id);
        const historyRows = db
            .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
            .all(workflowRow.id);
        return {
            id: workflowRow.id,
            name: workflowRow.name,
            description: workflowRow.description ?? undefined,
            tasks: taskRows.map(deserializeWorkflowTask),
            executionMode: workflowRow.execution_mode,
            maxParallel: workflowRow.max_parallel ?? undefined,
            fileQueue: fileRows.map(deserializeWorkflowFile),
            history: historyRows.map(deserializeWorkflowHistory),
            status: workflowRow.status,
            watcherConfig: normalizeWatcherConfig(workflowRow.watcher_config),
            createdAt: workflowRow.created_at,
            updatedAt: workflowRow.updated_at
        };
    });
};
exports.listWorkflows = listWorkflows;
const createWorkflow = (name) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    const workflow = {
        id: (0, node_crypto_1.randomUUID)(),
        name,
        description: undefined,
        tasks: [],
        executionMode: 'sequential',
        maxParallel: 2,
        fileQueue: [],
        history: [],
        status: 'idle',
        watcherConfig: { ...defaultWatcherConfig },
        createdAt: now,
        updatedAt: now
    };
    db.prepare('INSERT INTO workflows (id, name, description, execution_mode, max_parallel, status, watcher_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(workflow.id, workflow.name, workflow.description ?? null, workflow.executionMode, workflow.maxParallel ?? null, workflow.status, JSON.stringify(workflow.watcherConfig ?? defaultWatcherConfig), workflow.createdAt, workflow.updatedAt);
    return workflow;
};
exports.createWorkflow = createWorkflow;
const addWorkflowTask = (workflowId, taskData) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    const task = {
        id: (0, node_crypto_1.randomUUID)(),
        name: taskData.name,
        type: taskData.type,
        config: taskData.config,
        order: 0,
        createdAt: now
    };
    const nextOrder = db
        .prepare('SELECT COALESCE(MAX(task_order), -1) as maxOrder FROM tasks WHERE workflow_id = ?')
        .get(workflowId).maxOrder + 1;
    task.order = nextOrder;
    const serialized = serializeWorkflowTask(task);
    db.prepare(`INSERT INTO tasks (id, workflow_id, type, name, config, status, progress, error, task_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(serialized.id, workflowId, serialized.type, serialized.name, serialized.config, 'pending', null, null, serialized.order, serialized.createdAt);
    db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(now, workflowId);
    return task;
};
exports.addWorkflowTask = addWorkflowTask;
const removeWorkflowTask = (workflowId, taskId) => {
    const db = (0, db_1.getDatabase)();
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND workflow_id = ?').run(taskId, workflowId);
    if (result.changes > 0) {
        db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
    }
    return result.changes > 0;
};
exports.removeWorkflowTask = removeWorkflowTask;
const addWorkflowFiles = (workflowId, filePaths) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    const created = [];
    const insert = db.prepare('INSERT INTO workflow_files (id, workflow_id, file_path, status, current_task_index, error, added_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const exists = db.prepare('SELECT 1 FROM workflow_files WHERE workflow_id = ? AND file_path = ? LIMIT 1');
    filePaths.forEach((filePath) => {
        if (!filePath) {
            return;
        }
        const existing = exists.get(workflowId, filePath);
        if (existing) {
            return;
        }
        const file = {
            id: (0, node_crypto_1.randomUUID)(),
            workflowId,
            filePath,
            status: 'pending',
            currentTaskIndex: 0,
            addedAt: now
        };
        insert.run(file.id, workflowId, file.filePath, file.status, file.currentTaskIndex, null, file.addedAt);
        created.push(file);
    });
    if (created.length > 0) {
        db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(now, workflowId);
    }
    return created;
};
exports.addWorkflowFiles = addWorkflowFiles;
const addWorkflowFolder = async (workflowId, folderPath) => {
    const entries = await (await Promise.resolve().then(() => __importStar(require('node:fs/promises')))).readdir(folderPath, { withFileTypes: true });
    const filePaths = entries
        .filter((entry) => entry.isFile())
        .map((entry) => node_path_1.default.join(folderPath, entry.name));
    return (0, exports.addWorkflowFiles)(workflowId, filePaths);
};
exports.addWorkflowFolder = addWorkflowFolder;
const updateWorkflowSettings = (workflowId, settings) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    db.prepare('UPDATE workflows SET execution_mode = ?, max_parallel = ?, updated_at = ? WHERE id = ?').run(settings.executionMode, settings.maxParallel ?? null, now, workflowId);
    const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId);
    const tasks = db
        .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
        .all(workflowId);
    const files = db
        .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
        .all(workflowId);
    const historyRows = db
        .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
        .all(workflowId);
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        tasks: tasks.map(deserializeWorkflowTask),
        executionMode: row.execution_mode,
        maxParallel: row.max_parallel ?? undefined,
        fileQueue: files.map(deserializeWorkflowFile),
        history: historyRows.map(deserializeWorkflowHistory),
        status: row.status,
        watcherConfig: normalizeWatcherConfig(row.watcher_config),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};
exports.updateWorkflowSettings = updateWorkflowSettings;
const updateWorkflowWatcherConfig = (workflowId, config) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    db.prepare('UPDATE workflows SET watcher_config = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(config), now, workflowId);
    const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId);
    const tasks = db
        .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
        .all(workflowId);
    const files = db
        .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
        .all(workflowId);
    const historyRows = db
        .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
        .all(workflowId);
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        tasks: tasks.map(deserializeWorkflowTask),
        executionMode: row.execution_mode,
        maxParallel: row.max_parallel ?? undefined,
        fileQueue: files.map(deserializeWorkflowFile),
        history: historyRows.map(deserializeWorkflowHistory),
        status: row.status,
        watcherConfig: normalizeWatcherConfig(row.watcher_config),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};
exports.updateWorkflowWatcherConfig = updateWorkflowWatcherConfig;
const getWorkflowById = (workflowId) => {
    const db = (0, db_1.getDatabase)();
    const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId);
    if (!row) {
        return null;
    }
    const tasks = db
        .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
        .all(workflowId);
    const files = db
        .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
        .all(workflowId);
    const historyRows = db
        .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
        .all(workflowId);
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        tasks: tasks.map(deserializeWorkflowTask),
        executionMode: row.execution_mode,
        maxParallel: row.max_parallel ?? undefined,
        fileQueue: files.map(deserializeWorkflowFile),
        history: historyRows.map(deserializeWorkflowHistory),
        status: row.status,
        watcherConfig: normalizeWatcherConfig(row.watcher_config),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};
exports.getWorkflowById = getWorkflowById;
const hasProcessedFile = (workflowId, filePath) => {
    const db = (0, db_1.getDatabase)();
    const row = db
        .prepare('SELECT 1 FROM processed_files WHERE workflow_id = ? AND file_path = ? LIMIT 1')
        .get(workflowId, filePath);
    return Boolean(row);
};
exports.hasProcessedFile = hasProcessedFile;
const recordProcessedFile = (workflowId, filePath) => {
    const db = (0, db_1.getDatabase)();
    try {
        db.prepare('INSERT INTO processed_files (workflow_id, file_path, processed_at) VALUES (?, ?, ?)').run(workflowId, filePath, new Date().toISOString());
    }
    catch {
        // ignore duplicates
    }
};
exports.recordProcessedFile = recordProcessedFile;
const archiveWorkflowFile = (workflowId, file, status, taskStatuses) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO workflow_history (id, workflow_id, file_path, status, started_at, completed_at, error, task_statuses, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(file.id, workflowId, file.filePath, status, file.startedAt ?? null, file.completedAt ?? null, file.error ?? null, JSON.stringify(taskStatuses), now);
    db.prepare('DELETE FROM workflow_files WHERE id = ?').run(file.id);
    db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(now, workflowId);
};
exports.archiveWorkflowFile = archiveWorkflowFile;
const updateWorkflowStatus = (workflowId, status) => {
    const db = (0, db_1.getDatabase)();
    db.prepare('UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), workflowId);
};
exports.updateWorkflowStatus = updateWorkflowStatus;
const updateWorkflowFileStatus = (fileId, status, extra) => {
    const db = (0, db_1.getDatabase)();
    db.prepare('UPDATE workflow_files SET status = ?, error = ?, started_at = ?, completed_at = ?, current_task_index = ? WHERE id = ?').run(status, extra?.error ?? null, extra?.startedAt ?? null, extra?.completedAt ?? null, extra?.currentTaskIndex ?? null, fileId);
};
exports.updateWorkflowFileStatus = updateWorkflowFileStatus;
const removeWorkflowFile = (workflowId, fileId) => {
    const db = (0, db_1.getDatabase)();
    const result = db
        .prepare('DELETE FROM workflow_files WHERE id = ? AND workflow_id = ?')
        .run(fileId, workflowId);
    if (result.changes > 0) {
        db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
    }
    return result.changes > 0;
};
exports.removeWorkflowFile = removeWorkflowFile;
const removeWorkflowHistoryItem = (workflowId, historyId) => {
    const db = (0, db_1.getDatabase)();
    const result = db
        .prepare('DELETE FROM workflow_history WHERE id = ? AND workflow_id = ?')
        .run(historyId, workflowId);
    if (result.changes > 0) {
        db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
    }
    return result.changes > 0;
};
exports.removeWorkflowHistoryItem = removeWorkflowHistoryItem;
const clearWorkflowHistory = (workflowId) => {
    const db = (0, db_1.getDatabase)();
    const result = db.prepare('DELETE FROM workflow_history WHERE workflow_id = ?').run(workflowId);
    if (result.changes > 0) {
        db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
    }
    return result.changes;
};
exports.clearWorkflowHistory = clearWorkflowHistory;
