import type { DirectoryWatcherConfig, TaskType } from '@shared/types';

export const taskLabels: Record<TaskType, string> = {
  copy: 'Copy',
  move: 'Move',
  delete: 'Delete'
};

export const getBaseName = (value: string) => {
  const normalized = value.replace(/\\/g, '/');
  const trimmed = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  const segments = trimmed.split('/');
  return segments[segments.length - 1] || '';
};

export const joinPath = (dir: string, name: string) => {
  if (!dir) {
    return name;
  }
  const separator = dir.includes('\\') ? '\\' : '/';
  const normalizedDir = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
  return `${normalizedDir}${separator}${name}`;
};

export const formatDuration = (durationMs?: number) => {
  if (!durationMs || durationMs < 0) {
    return '—';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

export const formatTimestamp = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

export const defaultWatcherConfig: DirectoryWatcherConfig = {
  enabled: false,
  watchPath: '',
  recursive: false,
  filters: {
    extensions: undefined,
    filenamePattern: undefined,
    ignoreHidden: true,
    minSize: undefined
  },
  ignoreExisting: true,
  stabilityDelay: 3000,
  pollInterval: undefined
};

export const parseExtensions = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (item.startsWith('.') ? item : `.${item}`));
