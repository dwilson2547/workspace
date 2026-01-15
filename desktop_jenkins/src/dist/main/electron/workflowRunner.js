"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pauseWorkflow = exports.runWorkflow = void 0;
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
const taskRunner_1 = require("./taskRunner");
const workflows_1 = require("./workflows");
const runningWorkflows = new Map();
const buildWorkflowTask = (template, filePath) => {
    const destinationDirectory = template.config?.destinationDirectory?.trim();
    const destinationPath = destinationDirectory
        ? node_path_1.default.join(destinationDirectory, node_path_1.default.basename(filePath))
        : undefined;
    return {
        id: (0, node_crypto_1.randomUUID)(),
        type: template.type,
        name: template.name,
        config: {
            sourcePath: filePath,
            destinationPath
        },
        status: 'pending',
        createdAt: new Date().toISOString()
    };
};
const runWorkflow = async (workflowId) => {
    if (runningWorkflows.has(workflowId)) {
        return;
    }
    runningWorkflows.set(workflowId, { cancelled: false });
    (0, workflows_1.updateWorkflowStatus)(workflowId, 'running');
    const workflow = (0, workflows_1.getWorkflowById)(workflowId);
    if (!workflow) {
        runningWorkflows.delete(workflowId);
        return;
    }
    const pendingFiles = workflow.fileQueue.filter((file) => file.status === 'pending');
    const tasks = workflow.tasks;
    if (pendingFiles.length === 0 || tasks.length === 0) {
        (0, workflows_1.updateWorkflowStatus)(workflowId, 'idle');
        runningWorkflows.delete(workflowId);
        return;
    }
    const controller = runningWorkflows.get(workflowId);
    const processFile = async (file) => {
        if (controller.cancelled) {
            return;
        }
        const startedAt = new Date().toISOString();
        (0, workflows_1.updateWorkflowFileStatus)(file.id, 'processing', { startedAt, currentTaskIndex: 0 });
        for (let index = 0; index < tasks.length; index += 1) {
            if (controller.cancelled) {
                (0, workflows_1.updateWorkflowFileStatus)(file.id, 'pending', { currentTaskIndex: index });
                return;
            }
            (0, workflows_1.updateWorkflowFileStatus)(file.id, 'processing', { currentTaskIndex: index + 1 });
            const task = buildWorkflowTask(tasks[index], file.filePath);
            try {
                await (0, taskRunner_1.runTask)(task);
            }
            catch (error) {
                const completedAt = new Date().toISOString();
                const errorMessage = error.message;
                (0, workflows_1.updateWorkflowFileStatus)(file.id, 'failed', {
                    error: errorMessage,
                    completedAt,
                    currentTaskIndex: index + 1
                });
                return;
            }
        }
        const completedAt = new Date().toISOString();
        (0, workflows_1.updateWorkflowFileStatus)(file.id, 'completed', {
            completedAt,
            currentTaskIndex: tasks.length
        });
    };
    if (workflow.executionMode === 'parallel') {
        const maxParallel = Math.max(1, workflow.maxParallel ?? 2);
        const queue = [...pendingFiles];
        const workers = Array.from({ length: Math.min(maxParallel, queue.length) }).map(async () => {
            while (queue.length > 0 && !controller.cancelled) {
                const next = queue.shift();
                if (!next) {
                    return;
                }
                await processFile(next);
            }
        });
        await Promise.all(workers);
    }
    else {
        for (const file of pendingFiles) {
            if (controller.cancelled) {
                break;
            }
            await processFile(file);
        }
    }
    if (controller.cancelled) {
        (0, workflows_1.updateWorkflowStatus)(workflowId, 'paused');
    }
    else {
        (0, workflows_1.updateWorkflowStatus)(workflowId, 'idle');
    }
    runningWorkflows.delete(workflowId);
};
exports.runWorkflow = runWorkflow;
const pauseWorkflow = (workflowId) => {
    const controller = runningWorkflows.get(workflowId);
    if (controller) {
        controller.cancelled = true;
    }
    (0, workflows_1.updateWorkflowStatus)(workflowId, 'paused');
};
exports.pauseWorkflow = pauseWorkflow;
