import * as chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { DirectoryWatcherConfig } from '../src/shared/types';
import {
  addWorkflowFiles,
  getWorkflowById,
  hasProcessedFile,
  recordProcessedFile
} from './workflows';
import { runWorkflow } from './workflowRunner';

const activeWatchers = new Map<string, FSWatcher>();
const debounceMap = new Map<string, NodeJS.Timeout>();

const globToRegex = (glob: string) => {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
  return new RegExp(regex, 'i');
};

const matchesFilters = async (filePath: string, config: DirectoryWatcherConfig): Promise<boolean> => {
  const baseName = path.basename(filePath);
  const filters = config.filters ?? {};

  if (filters.ignoreHidden && baseName.startsWith('.')) {
    return false;
  }

  if (filters.extensions && filters.extensions.length > 0) {
    const extension = path.extname(baseName).toLowerCase();
    const normalized = filters.extensions.map((item) => item.toLowerCase());
    if (!normalized.includes(extension)) {
      return false;
    }
  }

  if (filters.filenamePattern) {
    let matcher: RegExp;
    const pattern = filters.filenamePattern.trim();
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      matcher = new RegExp(pattern.slice(1, -1), 'i');
    } else {
      matcher = globToRegex(pattern);
    }
    if (!matcher.test(baseName)) {
      return false;
    }
  }

  if (typeof filters.minSize === 'number') {
    const stats = await fs.stat(filePath);
    if (stats.size < filters.minSize) {
      return false;
    }
  }

  return true;
};

const isFileStable = async (filePath: string, stabilityDelay: number) => {
  const interval = 1000;
  const checks = Math.max(2, Math.ceil(stabilityDelay / interval));
  let lastSize = -1;
  let stableCount = 0;
  for (let index = 0; index < checks; index += 1) {
    const stats = await fs.stat(filePath);
    if (lastSize === stats.size) {
      stableCount += 1;
      if (stableCount >= 2) {
        return true;
      }
    } else {
      stableCount = 0;
    }
    lastSize = stats.size;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return stableCount > 0;
};

const scheduleAdd = (workflowId: string, filePath: string, config: DirectoryWatcherConfig) => {
  const debounceKey = `${workflowId}:${filePath}`;
  const existing = debounceMap.get(debounceKey);
  if (existing) {
    clearTimeout(existing);
  }
  const handle = setTimeout(async () => {
    debounceMap.delete(debounceKey);
    try {
      if (hasProcessedFile(workflowId, filePath)) {
        return;
      }
      if (!(await matchesFilters(filePath, config))) {
        return;
      }
      const stable = await isFileStable(filePath, config.stabilityDelay || 3000);
      if (!stable) {
        return;
      }
      await addWorkflowFiles(workflowId, [filePath]);
      recordProcessedFile(workflowId, filePath);
      await runWorkflow(workflowId);
    } catch {
      // Ignore files that disappear or become inaccessible
    }
  }, 500);
  debounceMap.set(debounceKey, handle);
};

export const startWorkflowWatcher = async (workflowId: string) => {
  if (activeWatchers.has(workflowId)) {
    return;
  }
  const workflow = getWorkflowById(workflowId);
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

  watcher.on('add', (filePath: string) => {
    scheduleAdd(workflowId, filePath, config);
  });

  activeWatchers.set(workflowId, watcher);
};

export const stopWorkflowWatcher = async (workflowId: string) => {
  const watcher = activeWatchers.get(workflowId);
  if (!watcher) {
    return;
  }
  await watcher.close();
  activeWatchers.delete(workflowId);
};
