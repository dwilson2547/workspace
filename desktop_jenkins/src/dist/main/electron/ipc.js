"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = void 0;
const electron_1 = require("electron");
const queues_1 = require("./queues");
const taskRunner_1 = require("./taskRunner");
const runningQueues = new Set();
const runQueue = async (queueId) => {
    if (runningQueues.has(queueId)) {
        return;
    }
    runningQueues.add(queueId);
    (0, queues_1.updateQueueStatus)(queueId, 'running');
    const queues = (0, queues_1.listQueues)();
    const queue = queues.find((item) => item.id === queueId);
    if (!queue) {
        runningQueues.delete(queueId);
        return;
    }
    for (let index = queue.currentTaskIndex; index < queue.tasks.length; index += 1) {
        if (!runningQueues.has(queueId)) {
            (0, queues_1.updateQueueStatus)(queueId, 'paused');
            (0, queues_1.updateQueueCurrentIndex)(queueId, index);
            return;
        }
        const task = queue.tasks[index];
        const startedAt = new Date().toISOString();
        (0, queues_1.updateTaskStatus)(task.id, 'running', { startedAt });
        try {
            await (0, taskRunner_1.runTask)(task);
            (0, queues_1.updateTaskStatus)(task.id, 'completed', { completedAt: new Date().toISOString() });
        }
        catch (error) {
            (0, queues_1.updateTaskStatus)(task.id, 'failed', { error: error.message, completedAt: new Date().toISOString() });
            (0, queues_1.updateQueueStatus)(queueId, 'paused');
            runningQueues.delete(queueId);
            (0, queues_1.updateQueueCurrentIndex)(queueId, index);
            return;
        }
    }
    (0, queues_1.updateQueueStatus)(queueId, 'completed');
    (0, queues_1.updateQueueCurrentIndex)(queueId, queue.tasks.length);
    runningQueues.delete(queueId);
};
const registerIpcHandlers = () => {
    electron_1.ipcMain.handle('queues:list', () => (0, queues_1.listQueues)());
    electron_1.ipcMain.handle('queues:create', (_event, name) => (0, queues_1.createQueue)(name));
    electron_1.ipcMain.handle('queues:add-task', (_event, queueId, task) => (0, queues_1.addTaskToQueue)(queueId, { name: task.name, type: task.type, config: task.config }));
    electron_1.ipcMain.handle('queues:run', (_event, queueId) => runQueue(queueId));
    electron_1.ipcMain.handle('queues:pause', (_event, queueId) => {
        runningQueues.delete(queueId);
        (0, queues_1.updateQueueStatus)(queueId, 'paused');
    });
    electron_1.ipcMain.handle('picker:open', async (_event, options) => {
        const properties = [];
        if (options.mode === 'file') {
            properties.push('openFile');
        }
        else if (options.mode === 'directory') {
            properties.push('openDirectory');
        }
        else {
            properties.push('openFile', 'openDirectory');
        }
        if (options.allowMultiple) {
            properties.push('multiSelections');
        }
        const browserWindow = electron_1.BrowserWindow.getFocusedWindow() ?? undefined;
        const result = await electron_1.dialog.showOpenDialog(browserWindow, {
            title: options.title,
            properties
        });
        if (result.canceled) {
            return [];
        }
        return result.filePaths;
    });
};
exports.registerIpcHandlers = registerIpcHandlers;
