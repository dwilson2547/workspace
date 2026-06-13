import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@tqm/shared';
import type {
  TaskProgressEvent,
  QueueStatusEvent,
  WorkflowStatusEvent,
  WorkflowFileEvent,
  FileDetectedEvent,
  DownloadProgressEvent,
  DependencyStatusEvent,
} from '@tqm/shared';

let mainWindow: BrowserWindow | null = null;

/**
 * Set the main window reference for event emission
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
}

/**
 * Get the main window reference
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Emit an event to the renderer process
 */
function emitToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Emitters
// ─────────────────────────────────────────────────────────────────────────────

export function emitTaskProgress(event: TaskProgressEvent): void {
  emitToRenderer(IPC_CHANNELS.EVENTS.TASK_PROGRESS, event);
}

export function emitQueueStatus(event: QueueStatusEvent): void {
  emitToRenderer(IPC_CHANNELS.EVENTS.QUEUE_STATUS, event);
}

export function emitWorkflowStatus(event: WorkflowStatusEvent): void {
  emitToRenderer(IPC_CHANNELS.EVENTS.WORKFLOW_STATUS, event);
}

export function emitWorkflowFile(event: WorkflowFileEvent): void {
  emitToRenderer(IPC_CHANNELS.EVENTS.WORKFLOW_FILE, event);
}

export function emitFileDetected(event: FileDetectedEvent): void {
  emitToRenderer(IPC_CHANNELS.EVENTS.FILE_DETECTED, event);
}

export function emitDownloadProgress(event: DownloadProgressEvent): void {
  emitToRenderer(IPC_CHANNELS.EVENTS.DOWNLOAD_PROGRESS, event);
}

export function emitDependencyStatus(event: DependencyStatusEvent): void {
  emitToRenderer(IPC_CHANNELS.EVENTS.DEPENDENCY_STATUS, event);
}
