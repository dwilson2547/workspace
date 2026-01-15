"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    listQueues: () => electron_1.ipcRenderer.invoke('queues:list'),
    createQueue: (name) => electron_1.ipcRenderer.invoke('queues:create', name),
    addTask: (queueId, task) => electron_1.ipcRenderer.invoke('queues:add-task', queueId, task),
    removeTask: (queueId, taskId) => electron_1.ipcRenderer.invoke('queues:remove-task', queueId, taskId),
    runQueue: (queueId) => electron_1.ipcRenderer.invoke('queues:run', queueId),
    pauseQueue: (queueId) => electron_1.ipcRenderer.invoke('queues:pause', queueId),
    listWorkflows: () => electron_1.ipcRenderer.invoke('workflows:list'),
    createWorkflow: (name) => electron_1.ipcRenderer.invoke('workflows:create', name),
    addWorkflowTask: (workflowId, task) => electron_1.ipcRenderer.invoke('workflows:add-task', workflowId, task),
    removeWorkflowTask: (workflowId, taskId) => electron_1.ipcRenderer.invoke('workflows:remove-task', workflowId, taskId),
    addWorkflowFiles: (workflowId, filePaths) => electron_1.ipcRenderer.invoke('workflows:add-files', workflowId, filePaths),
    addWorkflowFolder: (workflowId, folderPath) => electron_1.ipcRenderer.invoke('workflows:add-folder', workflowId, folderPath),
    updateWorkflowSettings: (workflowId, settings) => electron_1.ipcRenderer.invoke('workflows:update-settings', workflowId, settings),
    updateWorkflowWatcherConfig: (workflowId, config) => electron_1.ipcRenderer.invoke('workflows:update-watcher-config', workflowId, config),
    startWorkflowWatcher: (workflowId) => electron_1.ipcRenderer.invoke('workflows:watcher-start', workflowId),
    stopWorkflowWatcher: (workflowId) => electron_1.ipcRenderer.invoke('workflows:watcher-stop', workflowId),
    runWorkflow: (workflowId) => electron_1.ipcRenderer.invoke('workflows:run', workflowId),
    pauseWorkflow: (workflowId) => electron_1.ipcRenderer.invoke('workflows:pause', workflowId),
    pickPath: (options) => electron_1.ipcRenderer.invoke('picker:open', options)
});
