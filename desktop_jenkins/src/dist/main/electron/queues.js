"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveTask = exports.updateQueueCurrentIndex = exports.updateTaskStatus = exports.updateQueueStatus = exports.removeQueueHistoryItem = exports.removeTaskFromQueue = exports.addTaskToQueue = exports.createQueue = exports.listQueues = void 0;
const node_crypto_1 = require("node:crypto");
const db_1 = require("./db");
const serializeTask = (task) => ({
    ...task,
    config: JSON.stringify(task.config)
});
const deserializeTask = (row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    config: JSON.parse(row.config),
    status: row.status,
    progress: row.progress ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined
});
const deserializeHistory = (row) => ({
    id: row.id,
    queueId: row.queue_id,
    durationMs: row.duration_ms ?? undefined,
    task: {
        id: row.id,
        type: row.type,
        name: row.name,
        config: JSON.parse(row.config),
        status: row.status,
        progress: row.progress ?? undefined,
        error: row.error ?? undefined,
        createdAt: row.created_at,
        startedAt: row.started_at ?? undefined,
        completedAt: row.completed_at ?? undefined
    }
});
const listQueues = () => {
    const db = (0, db_1.getDatabase)();
    const queueRows = db.prepare('SELECT * FROM queues ORDER BY created_at ASC').all();
    return queueRows.map((queueRow) => {
        const taskRows = db
            .prepare('SELECT * FROM tasks WHERE queue_id = ? AND status IN (?, ?) ORDER BY task_order ASC')
            .all(queueRow.id, 'pending', 'running');
        const historyRows = db
            .prepare('SELECT * FROM task_history WHERE queue_id = ? ORDER BY completed_at DESC')
            .all(queueRow.id);
        return {
            id: queueRow.id,
            name: queueRow.name,
            description: queueRow.description ?? undefined,
            status: queueRow.status,
            currentTaskIndex: queueRow.current_task_index ?? 0,
            createdAt: queueRow.created_at,
            updatedAt: queueRow.updated_at,
            tasks: taskRows.map(deserializeTask),
            history: historyRows.map(deserializeHistory)
        };
    });
};
exports.listQueues = listQueues;
const createQueue = (name) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    const queue = {
        id: (0, node_crypto_1.randomUUID)(),
        name,
        description: undefined,
        status: 'paused',
        currentTaskIndex: 0,
        createdAt: now,
        updatedAt: now,
        tasks: [],
        history: []
    };
    db.prepare('INSERT INTO queues (id, name, description, status, current_task_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(queue.id, queue.name, queue.description ?? null, queue.status, queue.currentTaskIndex, queue.createdAt, queue.updatedAt);
    return queue;
};
exports.createQueue = createQueue;
const addTaskToQueue = (queueId, taskData) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    const task = {
        id: (0, node_crypto_1.randomUUID)(),
        name: taskData.name,
        type: taskData.type,
        config: taskData.config,
        status: 'pending',
        createdAt: now
    };
    const nextOrder = db
        .prepare('SELECT COALESCE(MAX(task_order), -1) as maxOrder FROM tasks WHERE queue_id = ?')
        .get(queueId).maxOrder + 1;
    const serialized = serializeTask(task);
    db.prepare(`INSERT INTO tasks (id, queue_id, type, name, config, status, progress, error, task_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(serialized.id, queueId, serialized.type, serialized.name, serialized.config, serialized.status, serialized.progress ?? null, serialized.error ?? null, nextOrder, serialized.createdAt);
    db.prepare('UPDATE queues SET updated_at = ? WHERE id = ?').run(now, queueId);
    return task;
};
exports.addTaskToQueue = addTaskToQueue;
const removeTaskFromQueue = (queueId, taskId) => {
    const db = (0, db_1.getDatabase)();
    const result = db
        .prepare('DELETE FROM tasks WHERE id = ? AND queue_id = ? AND status = ?')
        .run(taskId, queueId, 'pending');
    if (result.changes > 0) {
        db.prepare('UPDATE queues SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), queueId);
    }
    return result.changes > 0;
};
exports.removeTaskFromQueue = removeTaskFromQueue;
const removeQueueHistoryItem = (queueId, historyId) => {
    const db = (0, db_1.getDatabase)();
    const result = db
        .prepare('DELETE FROM task_history WHERE id = ? AND queue_id = ?')
        .run(historyId, queueId);
    if (result.changes > 0) {
        db.prepare('UPDATE queues SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), queueId);
    }
    return result.changes > 0;
};
exports.removeQueueHistoryItem = removeQueueHistoryItem;
const updateQueueStatus = (queueId, status) => {
    const db = (0, db_1.getDatabase)();
    const now = new Date().toISOString();
    db.prepare('UPDATE queues SET status = ?, updated_at = ? WHERE id = ?').run(status, now, queueId);
};
exports.updateQueueStatus = updateQueueStatus;
const updateTaskStatus = (taskId, status, extra) => {
    const db = (0, db_1.getDatabase)();
    db.prepare('UPDATE tasks SET status = ?, error = ?, started_at = ?, completed_at = ? WHERE id = ?').run(status, extra?.error ?? null, extra?.startedAt ?? null, extra?.completedAt ?? null, taskId);
};
exports.updateTaskStatus = updateTaskStatus;
const updateQueueCurrentIndex = (queueId, index) => {
    const db = (0, db_1.getDatabase)();
    db.prepare('UPDATE queues SET current_task_index = ? WHERE id = ?').run(index, queueId);
};
exports.updateQueueCurrentIndex = updateQueueCurrentIndex;
const archiveTask = (queueId, task, durationMs) => {
    const db = (0, db_1.getDatabase)();
    const serialized = serializeTask(task);
    db.prepare(`INSERT INTO task_history (id, queue_id, type, name, config, status, progress, error, created_at, started_at, completed_at, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(serialized.id, queueId, serialized.type, serialized.name, serialized.config, serialized.status, serialized.progress ?? null, serialized.error ?? null, serialized.createdAt, serialized.startedAt ?? null, serialized.completedAt ?? null, durationMs ?? null);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
    db.prepare('UPDATE queues SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), queueId);
};
exports.archiveTask = archiveTask;
