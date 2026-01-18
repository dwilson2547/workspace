import type { DirectoryWatcherConfig, TaskType } from '@shared/types';

export const taskLabels: Record<TaskType, string> = {
  copy: 'Copy',
  move: 'Move',
  delete: 'Delete',
  rsync: 'Rsync',
  ffmpeg: 'FFmpeg Transcode',
  archiveCreate: 'Create Archive',
  archiveExtract: 'Extract Archive',
  chmod: 'Change Permissions',
  chown: 'Change Ownership',
  ftp: 'FTP Transfer',
  sftp: 'SFTP Transfer'
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

export const replaceExtension = (fileName: string, extension: string) => {
  if (!extension) {
    return fileName;
  }
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const normalized = fileName.replace(/\\/g, '/');
  const base = normalized.split('/').pop() ?? fileName;
  const lastDot = base.lastIndexOf('.');
  const stem = lastDot > 0 ? base.slice(0, lastDot) : base;
  return `${stem}${normalizedExtension}`;
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

export const ffmpegCodecOptions = [
  { label: 'Copy (no re-encode)', value: 'copy' },
  { label: 'H.264 (libx264)', value: 'libx264' },
  { label: 'H.265 (libx265)', value: 'libx265' },
  { label: 'AV1 (libaom-av1)', value: 'libaom-av1' },
  { label: 'VP9 (libvpx-vp9)', value: 'libvpx-vp9' },
  { label: 'ProRes (prores_ks)', value: 'prores_ks' },
  { label: 'H.264 NVENC (NVIDIA)', value: 'h264_nvenc' },
  { label: 'H.265 NVENC (NVIDIA)', value: 'hevc_nvenc' },
  { label: 'AV1 NVENC (NVIDIA)', value: 'av1_nvenc' },
  { label: 'H.264 QuickSync (Intel)', value: 'h264_qsv' },
  { label: 'H.265 QuickSync (Intel)', value: 'hevc_qsv' },
  { label: 'AV1 QuickSync (Intel)', value: 'av1_qsv' },
  { label: 'H.264 AMF (AMD)', value: 'h264_amf' },
  { label: 'H.265 AMF (AMD)', value: 'hevc_amf' },
  { label: 'H.264 VideoToolbox (Apple)', value: 'h264_videotoolbox' },
  { label: 'H.265 VideoToolbox (Apple)', value: 'hevc_videotoolbox' },
  { label: 'H.264 VAAPI (Linux)', value: 'h264_vaapi' },
  { label: 'H.265 VAAPI (Linux)', value: 'hevc_vaapi' }
];
