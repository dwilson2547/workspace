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
exports.stopWorkflowWatcher = exports.startWorkflowWatcher = void 0;
const chokidar = __importStar(require("chokidar"));
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = __importDefault(require("node:fs/promises"));
const workflows_1 = require("./workflows");
const workflowRunner_1 = require("./workflowRunner");
const activeWatchers = new Map();
const debounceMap = new Map();
const globToRegex = (glob) => {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regex = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
    return new RegExp(regex, 'i');
};
const matchesFilters = async (filePath, config) => {
    const baseName = node_path_1.default.basename(filePath);
    const filters = config.filters ?? {};
    if (filters.ignoreHidden && baseName.startsWith('.')) {
        return false;
    }
    if (filters.extensions && filters.extensions.length > 0) {
        const extension = node_path_1.default.extname(baseName).toLowerCase();
        const normalized = filters.extensions.map((item) => item.toLowerCase());
        if (!normalized.includes(extension)) {
            return false;
        }
    }
    if (filters.filenamePattern) {
        let matcher;
        const pattern = filters.filenamePattern.trim();
        if (pattern.startsWith('/') && pattern.endsWith('/')) {
            matcher = new RegExp(pattern.slice(1, -1), 'i');
        }
        else {
            matcher = globToRegex(pattern);
        }
        if (!matcher.test(baseName)) {
            return false;
        }
    }
    if (typeof filters.minSize === 'number') {
        const stats = await promises_1.default.stat(filePath);
        if (stats.size < filters.minSize) {
            return false;
        }
    }
    return true;
};
const isFileStable = async (filePath, stabilityDelay) => {
    const interval = 1000;
    const checks = Math.max(2, Math.ceil(stabilityDelay / interval));
    let lastSize = -1;
    let stableCount = 0;
    for (let index = 0; index < checks; index += 1) {
        const stats = await promises_1.default.stat(filePath);
        if (lastSize === stats.size) {
            stableCount += 1;
            if (stableCount >= 2) {
                return true;
            }
        }
        else {
            stableCount = 0;
        }
        lastSize = stats.size;
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return stableCount > 0;
};
const scheduleAdd = (workflowId, filePath, config) => {
    const debounceKey = `${workflowId}:${filePath}`;
    const existing = debounceMap.get(debounceKey);
    if (existing) {
        clearTimeout(existing);
    }
    const handle = setTimeout(async () => {
        debounceMap.delete(debounceKey);
        try {
            if ((0, workflows_1.hasProcessedFile)(workflowId, filePath)) {
                return;
            }
            if (!(await matchesFilters(filePath, config))) {
                return;
            }
            const stable = await isFileStable(filePath, config.stabilityDelay || 3000);
            if (!stable) {
                return;
            }
            await (0, workflows_1.addWorkflowFiles)(workflowId, [filePath]);
            (0, workflows_1.recordProcessedFile)(workflowId, filePath);
            await (0, workflowRunner_1.runWorkflow)(workflowId);
        }
        catch {
            // Ignore files that disappear or become inaccessible
        }
    }, 500);
    debounceMap.set(debounceKey, handle);
};
const startWorkflowWatcher = async (workflowId) => {
    if (activeWatchers.has(workflowId)) {
        return;
    }
    const workflow = (0, workflows_1.getWorkflowById)(workflowId);
    if (!workflow || !workflow.watcherConfig?.watchPath) {
        return;
    }
    const config = workflow.watcherConfig;
    if (!config.enabled) {
        return;
    }
    const usePolling = typeof config.pollInterval === 'number' && config.pollInterval > 0;
    const watcher = chokidar.watch(config.watchPath, {
        ignoreInitial: config.ignoreExisting,
        persistent: true,
        depth: config.recursive ? undefined : 0,
        ignored: config.filters?.ignoreHidden ? /(^|[\/\\])\../ : undefined,
        usePolling,
        interval: usePolling ? config.pollInterval : undefined
    });
    watcher.on('add', (filePath) => {
        scheduleAdd(workflowId, filePath, config);
    });
    activeWatchers.set(workflowId, watcher);
};
exports.startWorkflowWatcher = startWorkflowWatcher;
const stopWorkflowWatcher = async (workflowId) => {
    const watcher = activeWatchers.get(workflowId);
    if (!watcher) {
        return;
    }
    await watcher.close();
    activeWatchers.delete(workflowId);
};
exports.stopWorkflowWatcher = stopWorkflowWatcher;
