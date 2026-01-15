"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    listQueues: () => electron_1.ipcRenderer.invoke('queues:list'),
    createQueue: (name) => electron_1.ipcRenderer.invoke('queues:create', name),
    addTask: (queueId, task) => electron_1.ipcRenderer.invoke('queues:add-task', queueId, task),
    runQueue: (queueId) => electron_1.ipcRenderer.invoke('queues:run', queueId),
    pauseQueue: (queueId) => electron_1.ipcRenderer.invoke('queues:pause', queueId),
    pickPath: (options) => electron_1.ipcRenderer.invoke('picker:open', options)
});
