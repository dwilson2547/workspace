"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQueueCurrentIndex = exports.updateTaskStatus = exports.updateQueueStatus = exports.addTaskToQueue = exports.createQueue = exports.listQueues = void 0;
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
const listQueues = () => {
    const db = (0, db_1.getDatabase)();
    const queueRows = db.prepare('SELECT * FROM queues ORDER BY created_at ASC').all();
    return queueRows.map((queueRow) => {
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
        tasks: []
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
