"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = void 0;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const queues_1 = require("./queues");
const workflows_1 = require("./workflows");
const watchers_1 = require("./watchers");
const taskRunner_1 = require("./taskRunner");
const workflowRunner_1 = require("./workflowRunner");
const runningQueues = new Set();
const runQueue = async (queueId) => {
    if (runningQueues.has(queueId)) {
        return;
    }
    runningQueues.add(queueId);
    (0, queues_1.updateQueueStatus)(queueId, 'running');
    (0, queues_1.updateQueueCurrentIndex)(queueId, 0);
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
            const completedAt = new Date().toISOString();
            const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
            (0, queues_1.updateTaskStatus)(task.id, 'completed', { completedAt });
            (0, queues_1.archiveTask)(queueId, { ...task, status: 'completed', startedAt, completedAt }, durationMs);
        }
        catch (error) {
            const completedAt = new Date().toISOString();
            const errorMessage = error.message;
            const durationMs = Date.parse(completedAt) - Date.parse(startedAt);
            (0, queues_1.updateTaskStatus)(task.id, 'failed', { error: errorMessage, completedAt });
            (0, queues_1.archiveTask)(queueId, { ...task, status: 'failed', error: errorMessage, startedAt, completedAt }, durationMs);
            (0, queues_1.updateQueueStatus)(queueId, 'paused');
            runningQueues.delete(queueId);
            (0, queues_1.updateQueueCurrentIndex)(queueId, 0);
            return;
        }
    }
    (0, queues_1.updateQueueStatus)(queueId, 'completed');
    (0, queues_1.updateQueueCurrentIndex)(queueId, 0);
    runningQueues.delete(queueId);
};
const registerIpcHandlers = () => {
    electron_1.ipcMain.handle('queues:list', () => (0, queues_1.listQueues)());
    electron_1.ipcMain.handle('queues:create', (_event, name) => (0, queues_1.createQueue)(name));
    electron_1.ipcMain.handle('queues:add-task', (_event, queueId, task) => (0, queues_1.addTaskToQueue)(queueId, { name: task.name, type: task.type, config: task.config }));
    electron_1.ipcMain.handle('queues:remove-task', (_event, queueId, taskId) => (0, queues_1.removeTaskFromQueue)(queueId, taskId));
    electron_1.ipcMain.handle('queues:remove-history-item', (_event, queueId, historyId) => (0, queues_1.removeQueueHistoryItem)(queueId, historyId));
    electron_1.ipcMain.handle('queues:run', (_event, queueId) => runQueue(queueId));
    electron_1.ipcMain.handle('queues:pause', (_event, queueId) => {
        runningQueues.delete(queueId);
        (0, queues_1.updateQueueStatus)(queueId, 'paused');
    });
    electron_1.ipcMain.handle('workflows:list', () => (0, workflows_1.listWorkflows)());
    electron_1.ipcMain.handle('workflows:create', (_event, name) => (0, workflows_1.createWorkflow)(name));
    electron_1.ipcMain.handle('workflows:add-task', (_event, workflowId, task) => (0, workflows_1.addWorkflowTask)(workflowId, { name: task.name, type: task.type, config: task.config }));
    electron_1.ipcMain.handle('workflows:remove-task', (_event, workflowId, taskId) => (0, workflows_1.removeWorkflowTask)(workflowId, taskId));
    electron_1.ipcMain.handle('workflows:add-files', (_event, workflowId, filePaths) => (0, workflows_1.addWorkflowFiles)(workflowId, filePaths));
    electron_1.ipcMain.handle('workflows:add-folder', async (_event, workflowId, folderPath) => (0, workflows_1.addWorkflowFolder)(workflowId, folderPath));
    electron_1.ipcMain.handle('workflows:update-settings', (_event, workflowId, settings) => (0, workflows_1.updateWorkflowSettings)(workflowId, settings));
    electron_1.ipcMain.handle('workflows:update-watcher-config', (_event, workflowId, config) => (0, workflows_1.updateWorkflowWatcherConfig)(workflowId, config));
    electron_1.ipcMain.handle('workflows:watcher-start', async (_event, workflowId) => {
        await (0, watchers_1.startWorkflowWatcher)(workflowId);
    });
    electron_1.ipcMain.handle('workflows:watcher-stop', async (_event, workflowId) => {
        await (0, watchers_1.stopWorkflowWatcher)(workflowId);
    });
    electron_1.ipcMain.handle('workflows:remove-file', (_event, workflowId, fileId) => (0, workflows_1.removeWorkflowFile)(workflowId, fileId));
    electron_1.ipcMain.handle('workflows:remove-history-item', (_event, workflowId, historyId) => (0, workflows_1.removeWorkflowHistoryItem)(workflowId, historyId));
    electron_1.ipcMain.handle('workflows:clear-history', (_event, workflowId) => (0, workflows_1.clearWorkflowHistory)(workflowId));
    electron_1.ipcMain.handle('workflows:export-history', async (_event, workflowId) => {
        const workflow = (0, workflows_1.getWorkflowById)(workflowId);
        if (!workflow) {
            return null;
        }
        const browserWindow = electron_1.BrowserWindow.getFocusedWindow();
        const suggestedName = `${workflow.name.replace(/\s+/g, '-').toLowerCase()}-history.json`;
        const dialogOptions = {
            title: 'Export Workflow History',
            defaultPath: suggestedName,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        };
        const result = browserWindow
            ? await electron_1.dialog.showSaveDialog(browserWindow, dialogOptions)
            : await electron_1.dialog.showSaveDialog(dialogOptions);
        if (result.canceled || !result.filePath) {
            return null;
        }
        await promises_1.default.writeFile(result.filePath, JSON.stringify(workflow.history, null, 2), 'utf-8');
        return result.filePath;
    });
    electron_1.ipcMain.handle('workflows:run', (_event, workflowId) => (0, workflowRunner_1.runWorkflow)(workflowId));
    electron_1.ipcMain.handle('workflows:pause', (_event, workflowId) => {
        (0, workflowRunner_1.pauseWorkflow)(workflowId);
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
        const browserWindow = electron_1.BrowserWindow.getFocusedWindow();
        const dialogOptions = {
            title: options.title,
            properties
        };
        const result = browserWindow
            ? await electron_1.dialog.showOpenDialog(browserWindow, dialogOptions)
            : await electron_1.dialog.showOpenDialog(dialogOptions);
        if (result.canceled) {
            return [];
        }
        return result.filePaths;
    });
};
exports.registerIpcHandlers = registerIpcHandlers;
