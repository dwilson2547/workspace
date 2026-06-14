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
const replaceExtension = (fileName, extension) => {
    if (!extension) {
        return fileName;
    }
    const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
    const parsed = node_path_1.default.parse(fileName);
    return `${parsed.name}${normalizedExtension}`;
};
const resolveArchiveExtension = (format) => {
    if (format === 'tar') {
        return '.tar';
    }
    if (format === 'tar.gz') {
        return '.tar.gz';
    }
    return '.zip';
};
const buildWorkflowTask = (template, filePath) => {
    const destinationDirectory = template.config?.destinationDirectory?.trim();
    const destinationName = template.config?.destinationName?.trim();
    const baseName = node_path_1.default.basename(filePath);
    let destinationPath;
    if (destinationDirectory) {
        if (template.type === 'ffmpeg') {
            const outputName = destinationName || replaceExtension(baseName, template.config?.outputExtension);
            destinationPath = node_path_1.default.join(destinationDirectory, outputName);
        }
        else if (template.type === 'archiveCreate') {
            const archiveName = destinationName || `${node_path_1.default.parse(baseName).name}${resolveArchiveExtension(template.config?.archiveFormat)}`;
            destinationPath = node_path_1.default.join(destinationDirectory, archiveName);
        }
        else if (template.type === 'archiveExtract') {
            destinationPath = destinationDirectory;
        }
        else {
            destinationPath = node_path_1.default.join(destinationDirectory, destinationName || baseName);
        }
    }
    return {
        id: (0, node_crypto_1.randomUUID)(),
        type: template.type,
        name: template.name,
        config: {
            sourcePath: filePath,
            destinationPath,
            rsyncArgs: template.config?.rsyncArgs,
            ffmpegArgs: template.config?.ffmpegArgs,
            ffmpegCodec: template.config?.ffmpegCodec,
            ffmpegCq: template.config?.ffmpegCq,
            outputExtension: template.config?.outputExtension,
            archiveFormat: template.config?.archiveFormat,
            chmodMode: template.config?.chmodMode,
            chmodRecursive: template.config?.chmodRecursive,
            chownUser: template.config?.chownUser,
            chownGroup: template.config?.chownGroup,
            chownRecursive: template.config?.chownRecursive,
            ftpHost: template.config?.ftpHost,
            ftpPort: template.config?.ftpPort,
            ftpUsername: template.config?.ftpUsername,
            ftpPassword: template.config?.ftpPassword,
            ftpRemotePath: template.config?.ftpRemotePath,
            ftpDirection: 'upload',
            ftpSecure: template.config?.ftpSecure,
            sftpHost: template.config?.sftpHost,
            sftpPort: template.config?.sftpPort,
            sftpUsername: template.config?.sftpUsername,
            sftpPassword: template.config?.sftpPassword,
            sftpRemotePath: template.config?.sftpRemotePath,
            sftpDirection: 'upload'
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
        const taskStatuses = [];
        for (let index = 0; index < tasks.length; index += 1) {
            if (controller.cancelled) {
                (0, workflows_1.updateWorkflowFileStatus)(file.id, 'pending', { currentTaskIndex: index });
                return;
            }
            (0, workflows_1.updateWorkflowFileStatus)(file.id, 'processing', { currentTaskIndex: index + 1 });
            const workflowTask = tasks[index];
            const task = buildWorkflowTask(workflowTask, file.filePath);
            const taskStartedAt = new Date().toISOString();
            try {
                await (0, taskRunner_1.runTask)(task);
                const taskCompletedAt = new Date().toISOString();
                taskStatuses.push({
                    taskId: workflowTask.id,
                    name: workflowTask.name,
                    type: workflowTask.type,
                    order: workflowTask.order,
                    status: 'completed',
                    startedAt: taskStartedAt,
                    completedAt: taskCompletedAt
                });
            }
            catch (error) {
                const completedAt = new Date().toISOString();
                const errorMessage = error.message;
                (0, workflows_1.updateWorkflowFileStatus)(file.id, 'failed', {
                    error: errorMessage,
                    completedAt,
                    currentTaskIndex: index + 1
                });
                taskStatuses.push({
                    taskId: workflowTask.id,
                    name: workflowTask.name,
                    type: workflowTask.type,
                    order: workflowTask.order,
                    status: 'failed',
                    startedAt: taskStartedAt,
                    completedAt,
                    error: errorMessage
                });
                (0, workflows_1.archiveWorkflowFile)(workflowId, {
                    ...file,
                    status: 'failed',
                    startedAt,
                    completedAt,
                    error: errorMessage,
                    currentTaskIndex: index + 1
                }, 'failed', taskStatuses);
                return;
            }
        }
        const completedAt = new Date().toISOString();
        (0, workflows_1.updateWorkflowFileStatus)(file.id, 'completed', {
            completedAt,
            currentTaskIndex: tasks.length
        });
        (0, workflows_1.archiveWorkflowFile)(workflowId, {
            ...file,
            status: 'completed',
            startedAt,
            completedAt,
            currentTaskIndex: tasks.length
        }, 'completed', taskStatuses);
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
