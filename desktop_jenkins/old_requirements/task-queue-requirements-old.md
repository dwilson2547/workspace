# Task Queue Manager - Requirements Specification

## Overview

A desktop task queue manager with a shared React frontend and swappable backends (Tauri/Rust or Electron/Node.js). The application manages file processing tasks through manual queuing and automated workflow triggers.

## Technology Stack

- **Frontend**: React with TypeScript (shared between backends)
- **Backend Options**:
  - **Tauri 2.x** with Rust (primary, smaller bundle)
  - **Electron** with Node.js (fallback, more stable WebView)
- **Database**: SQLite (`rusqlite` for Tauri, `better-sqlite3` for Electron)
- **File Watching**: `notify` crate (Tauri) / `chokidar` (Electron)

---

## Dual-Backend Architecture

The application uses a shared frontend with an abstraction layer that allows switching between Tauri and Electron backends without modifying UI code.

### Project Structure

```
task-queue-manager/
├── packages/
│   ├── frontend/                    # Shared React app
│   │   ├── src/
│   │   │   ├── components/          # UI components
│   │   │   ├── hooks/               # React hooks
│   │   │   ├── stores/              # State management
│   │   │   ├── pages/               # Page components
│   │   │   └── api/
│   │   │       ├── bridge.ts        # Abstract backend interface
│   │   │       ├── tauri-bridge.ts  # Tauri implementation
│   │   │       └── electron-bridge.ts # Electron implementation
│   │   ├── index.html
│   │   └── package.json
│   │
│   ├── backend-tauri/               # Tauri/Rust backend
│   │   ├── src/
│   │   │   ├── main.rs              # Entry point
│   │   │   ├── lib.rs               # Library root
│   │   │   ├── commands/            # Tauri command handlers
│   │   │   │   ├── mod.rs
│   │   │   │   ├── queue.rs
│   │   │   │   ├── task.rs
│   │   │   │   ├── workflow.rs
│   │   │   │   └── download.rs
│   │   │   ├── executors/           # Task executors
│   │   │   │   ├── mod.rs
│   │   │   │   ├── copy.rs
│   │   │   │   ├── transcode.rs
│   │   │   │   ├── archive.rs
│   │   │   │   └── download.rs
│   │   │   ├── db/                  # Database layer
│   │   │   │   ├── mod.rs
│   │   │   │   ├── migrations.rs
│   │   │   │   └── models.rs
│   │   │   ├── watcher/             # File watching
│   │   │   └── events.rs            # Event emission
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   │
│   └── backend-electron/            # Electron/Node.js backend
│       ├── src/
│       │   ├── main.ts              # Main process entry
│       │   ├── preload.ts           # Preload script
│       │   ├── handlers/            # IPC handlers
│       │   │   ├── index.ts
│       │   │   ├── queue.ts
│       │   │   ├── task.ts
│       │   │   ├── workflow.ts
│       │   │   └── download.ts
│       │   ├── executors/           # Task executors
│       │   │   ├── index.ts
│       │   │   ├── copy.ts
│       │   │   ├── transcode.ts
│       │   │   ├── archive.ts
│       │   │   └── download.ts
│       │   ├── db/                  # Database layer
│       │   │   ├── index.ts
│       │   │   ├── migrations.ts
│       │   │   └── models.ts
│       │   ├── watcher/             # File watching
│       │   └── events.ts            # Event emission
│       ├── package.json
│       └── electron-builder.json
│
├── shared/                          # Shared types & constants
│   ├── types.ts                     # TypeScript interfaces
│   ├── constants.ts                 # Shared constants
│   └── package.json
│
├── package.json                     # Workspace root
├── pnpm-workspace.yaml
└── README.md
```

### Backend Bridge Interface

The frontend communicates with either backend through a unified interface:

```typescript
// packages/frontend/src/api/bridge.ts

export interface BackendBridge {
  // ─── Queue Operations ───────────────────────────────────────────
  createQueue(name: string, maxParallel?: number): Promise<Queue>;
  getQueues(): Promise<Queue[]>;
  getQueue(id: string): Promise<Queue>;
  updateQueue(id: string, updates: Partial<Queue>): Promise<Queue>;
  deleteQueue(id: string): Promise<void>;
  startQueue(id: string): Promise<void>;
  pauseQueue(id: string): Promise<void>;

  // ─── Task Operations ────────────────────────────────────────────
  createTask(queueId: string, config: TaskConfig): Promise<Task>;
  getTasks(queueId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  cancelTask(id: string): Promise<void>;
  retryTask(id: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // ─── Workflow Operations ────────────────────────────────────────
  createWorkflow(config: WorkflowConfig): Promise<Workflow>;
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow>;
  updateWorkflow(id: string, updates: Partial<WorkflowConfig>): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;
  startWorkflow(id: string): Promise<void>;
  pauseWorkflow(id: string): Promise<void>;
  addFilesToWorkflow(id: string, files: string[]): Promise<void>;

  // ─── Download Presets ───────────────────────────────────────────
  getUserContexts(): Promise<UserContext[]>;
  createUserContext(context: Omit<UserContext, 'id'>): Promise<UserContext>;
  updateUserContext(id: string, updates: Partial<UserContext>): Promise<UserContext>;
  deleteUserContext(id: string): Promise<void>;
  
  getHeaderPresets(): Promise<HeaderPreset[]>;
  createHeaderPreset(preset: Omit<HeaderPreset, 'id'>): Promise<HeaderPreset>;
  updateHeaderPreset(id: string, updates: Partial<HeaderPreset>): Promise<HeaderPreset>;
  deleteHeaderPreset(id: string): Promise<void>;

  // ─── Task Templates ─────────────────────────────────────────────
  getTaskTemplates(): Promise<TaskTemplate[]>;
  createTaskTemplate(template: Omit<TaskTemplate, 'id'>): Promise<TaskTemplate>;
  updateTaskTemplate(id: string, updates: Partial<TaskTemplate>): Promise<TaskTemplate>;
  deleteTaskTemplate(id: string): Promise<void>;

  // ─── Settings ───────────────────────────────────────────────────
  getSettings(): Promise<AppSettings>;
  updateSettings(updates: Partial<AppSettings>): Promise<AppSettings>;

  // ─── Dependencies ───────────────────────────────────────────────
  checkDependencies(): Promise<DependencyStatus[]>;

  // ─── File Dialogs ───────────────────────────────────────────────
  selectDirectory(title?: string): Promise<string | null>;
  selectFiles(options?: FileDialogOptions): Promise<string[]>;
  selectFile(options?: FileDialogOptions): Promise<string | null>;

  // ─── Events ─────────────────────────────────────────────────────
  onTaskProgress(callback: (event: TaskProgressEvent) => void): UnsubscribeFn;
  onQueueStatus(callback: (event: QueueStatusEvent) => void): UnsubscribeFn;
  onWorkflowStatus(callback: (event: WorkflowStatusEvent) => void): UnsubscribeFn;
  onWorkflowFile(callback: (event: WorkflowFileEvent) => void): UnsubscribeFn;
  onFileDetected(callback: (event: FileDetectedEvent) => void): UnsubscribeFn;
  onDownloadProgress(callback: (event: DownloadProgressEvent) => void): UnsubscribeFn;
  onDependencyStatus(callback: (event: DependencyStatusEvent) => void): UnsubscribeFn;
}

export type UnsubscribeFn = () => void;

export interface FileDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiple?: boolean;
}
```

### Bridge Factory

```typescript
// packages/frontend/src/api/bridge.ts (continued)

let bridgeInstance: BackendBridge | null = null;

export function getBridge(): BackendBridge {
  if (bridgeInstance) return bridgeInstance;
  
  if (typeof window !== 'undefined') {
    if ((window as any).__TAURI_INTERNALS__) {
      // Running in Tauri
      const { TauriBridge } = require('./tauri-bridge');
      bridgeInstance = new TauriBridge();
    } else if ((window as any).electronAPI) {
      // Running in Electron
      const { ElectronBridge } = require('./electron-bridge');
      bridgeInstance = new ElectronBridge();
    }
  }
  
  if (!bridgeInstance) {
    throw new Error('No backend detected. Must run in Tauri or Electron.');
  }
  
  return bridgeInstance;
}

// React hook for easy access
export function useBridge(): BackendBridge {
  return getBridge();
}
```

### Tauri Bridge Implementation

```typescript
// packages/frontend/src/api/tauri-bridge.ts

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { BackendBridge, UnsubscribeFn, FileDialogOptions } from './bridge';

export class TauriBridge implements BackendBridge {
  // ─── Queue Operations ───────────────────────────────────────────
  async createQueue(name: string, maxParallel = 1): Promise<Queue> {
    return invoke('create_queue', { name, maxParallel });
  }
  
  async getQueues(): Promise<Queue[]> {
    return invoke('get_queues');
  }
  
  async startQueue(id: string): Promise<void> {
    return invoke('start_queue', { id });
  }
  
  async pauseQueue(id: string): Promise<void> {
    return invoke('pause_queue', { id });
  }

  // ─── Task Operations ────────────────────────────────────────────
  async createTask(queueId: string, config: TaskConfig): Promise<Task> {
    return invoke('create_task', { queueId, config });
  }
  
  async cancelTask(id: string): Promise<void> {
    return invoke('cancel_task', { id });
  }

  // ─── Workflow Operations ────────────────────────────────────────
  async createWorkflow(config: WorkflowConfig): Promise<Workflow> {
    return invoke('create_workflow', { config });
  }
  
  async startWorkflow(id: string): Promise<void> {
    return invoke('start_workflow', { id });
  }

  // ─── Download Presets ───────────────────────────────────────────
  async getUserContexts(): Promise<UserContext[]> {
    return invoke('get_user_contexts');
  }
  
  async createUserContext(context: Omit<UserContext, 'id'>): Promise<UserContext> {
    return invoke('create_user_context', { context });
  }

  // ─── File Dialogs ───────────────────────────────────────────────
  async selectDirectory(title?: string): Promise<string | null> {
    const result = await open({ directory: true, title });
    return result as string | null;
  }
  
  async selectFiles(options?: FileDialogOptions): Promise<string[]> {
    const result = await open({
      multiple: options?.multiple ?? true,
      title: options?.title,
      filters: options?.filters,
    });
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
  }

  // ─── Events ─────────────────────────────────────────────────────
  onTaskProgress(callback: (event: TaskProgressEvent) => void): UnsubscribeFn {
    let unlisten: UnlistenFn | undefined;
    
    listen<TaskProgressEvent>('task-progress', (e) => {
      callback(e.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    
    return () => {
      unlisten?.();
    };
  }
  
  onQueueStatus(callback: (event: QueueStatusEvent) => void): UnsubscribeFn {
    let unlisten: UnlistenFn | undefined;
    listen<QueueStatusEvent>('queue-status', (e) => callback(e.payload))
      .then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }
  
  onDownloadProgress(callback: (event: DownloadProgressEvent) => void): UnsubscribeFn {
    let unlisten: UnlistenFn | undefined;
    listen<DownloadProgressEvent>('download-progress', (e) => callback(e.payload))
      .then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }

  // ... remaining method implementations follow same pattern
}
```

### Electron Bridge Implementation

```typescript
// packages/frontend/src/api/electron-bridge.ts

import type { BackendBridge, UnsubscribeFn, FileDialogOptions } from './bridge';

// Type for the exposed electron API
declare global {
  interface Window {
    electronAPI: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      on(channel: string, callback: (...args: any[]) => void): () => void;
    };
  }
}

export class ElectronBridge implements BackendBridge {
  // ─── Queue Operations ───────────────────────────────────────────
  async createQueue(name: string, maxParallel = 1): Promise<Queue> {
    return window.electronAPI.invoke('create-queue', { name, maxParallel });
  }
  
  async getQueues(): Promise<Queue[]> {
    return window.electronAPI.invoke('get-queues');
  }
  
  async startQueue(id: string): Promise<void> {
    return window.electronAPI.invoke('start-queue', { id });
  }
  
  async pauseQueue(id: string): Promise<void> {
    return window.electronAPI.invoke('pause-queue', { id });
  }

  // ─── Task Operations ────────────────────────────────────────────
  async createTask(queueId: string, config: TaskConfig): Promise<Task> {
    return window.electronAPI.invoke('create-task', { queueId, config });
  }
  
  async cancelTask(id: string): Promise<void> {
    return window.electronAPI.invoke('cancel-task', { id });
  }

  // ─── Workflow Operations ────────────────────────────────────────
  async createWorkflow(config: WorkflowConfig): Promise<Workflow> {
    return window.electronAPI.invoke('create-workflow', { config });
  }
  
  async startWorkflow(id: string): Promise<void> {
    return window.electronAPI.invoke('start-workflow', { id });
  }

  // ─── Download Presets ───────────────────────────────────────────
  async getUserContexts(): Promise<UserContext[]> {
    return window.electronAPI.invoke('get-user-contexts');
  }
  
  async createUserContext(context: Omit<UserContext, 'id'>): Promise<UserContext> {
    return window.electronAPI.invoke('create-user-context', { context });
  }

  // ─── File Dialogs ───────────────────────────────────────────────
  async selectDirectory(title?: string): Promise<string | null> {
    return window.electronAPI.invoke('select-directory', { title });
  }
  
  async selectFiles(options?: FileDialogOptions): Promise<string[]> {
    return window.electronAPI.invoke('select-files', options);
  }

  // ─── Events ─────────────────────────────────────────────────────
  onTaskProgress(callback: (event: TaskProgressEvent) => void): UnsubscribeFn {
    return window.electronAPI.on('task-progress', callback);
  }
  
  onQueueStatus(callback: (event: QueueStatusEvent) => void): UnsubscribeFn {
    return window.electronAPI.on('queue-status', callback);
  }
  
  onDownloadProgress(callback: (event: DownloadProgressEvent) => void): UnsubscribeFn {
    return window.electronAPI.on('download-progress', callback);
  }

  // ... remaining method implementations follow same pattern
}
```

### Electron Preload Script

```typescript
// packages/backend-electron/src/preload.ts

import { contextBridge, ipcRenderer } from 'electron';

// Channel whitelist for security
const validInvokeChannels = [
  'create-queue', 'get-queues', 'get-queue', 'update-queue', 'delete-queue',
  'start-queue', 'pause-queue',
  'create-task', 'get-tasks', 'get-task', 'cancel-task', 'retry-task', 'delete-task',
  'create-workflow', 'get-workflows', 'get-workflow', 'update-workflow', 'delete-workflow',
  'start-workflow', 'pause-workflow', 'add-files-to-workflow',
  'get-user-contexts', 'create-user-context', 'update-user-context', 'delete-user-context',
  'get-header-presets', 'create-header-preset', 'update-header-preset', 'delete-header-preset',
  'get-task-templates', 'create-task-template', 'update-task-template', 'delete-task-template',
  'get-settings', 'update-settings',
  'check-dependencies',
  'select-directory', 'select-files', 'select-file',
];

const validOnChannels = [
  'task-progress', 'queue-status', 'workflow-status', 'workflow-file',
  'file-detected', 'download-progress', 'dependency-status',
];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid invoke channel: ${channel}`);
  },
  
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (validOnChannels.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => {
        callback(...args);
      };
      ipcRenderer.on(channel, subscription);
      
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    throw new Error(`Invalid on channel: ${channel}`);
  },
});
```

### Electron Main Process Setup

```typescript
// packages/backend-electron/src/main.ts

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { initDatabase } from './db';
import { registerQueueHandlers } from './handlers/queue';
import { registerTaskHandlers } from './handlers/task';
import { registerWorkflowHandlers } from './handlers/workflow';
import { registerDownloadHandlers } from './handlers/download';
import { registerSettingsHandlers } from './handlers/settings';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load frontend
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
  }
}

async function init() {
  await app.whenReady();
  
  // Initialize database
  await initDatabase();
  
  // Register IPC handlers
  registerQueueHandlers(ipcMain);
  registerTaskHandlers(ipcMain);
  registerWorkflowHandlers(ipcMain);
  registerDownloadHandlers(ipcMain);
  registerSettingsHandlers(ipcMain);
  
  // File dialog handlers
  ipcMain.handle('select-directory', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: options?.title,
    });
    return result.canceled ? null : result.filePaths[0];
  });
  
  ipcMain.handle('select-files', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', options?.multiple ? 'multiSelections' : undefined].filter(Boolean) as any,
      title: options?.title,
      filters: options?.filters,
    });
    return result.canceled ? [] : result.filePaths;
  });
  
  await createWindow();
}

init();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Export for emitting events to renderer
export function emitToRenderer(channel: string, data: any) {
  mainWindow?.webContents.send(channel, data);
}
```

### Build Configuration

```json
// package.json (workspace root)
{
  "name": "task-queue-manager",
  "private": true,
  "scripts": {
    "dev:frontend": "pnpm --filter frontend dev",
    "dev:tauri": "pnpm --filter backend-tauri tauri dev",
    "dev:electron": "pnpm --filter backend-electron dev",
    "build:frontend": "pnpm --filter frontend build",
    "build:tauri": "pnpm --filter backend-tauri tauri build",
    "build:electron": "pnpm --filter backend-electron build",
    "build:all": "pnpm build:frontend && pnpm build:tauri && pnpm build:electron"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'shared'
```

### Backend Comparison

| Aspect | Tauri (Rust) | Electron (Node.js) |
|--------|--------------|-------------------|
| **Bundle Size** | ~5-10 MB | ~150-200 MB |
| **Memory Usage** | Lower (~50-100 MB) | Higher (~200-400 MB) |
| **Startup Time** | ~0.5-1s | ~2-4s |
| **WebView** | System WebView2/WebKit | Bundled Chromium |
| **WebView Stability** | ⚠️ Windows WebView2 issues | ✅ Consistent across platforms |
| **Dev Ecosystem** | Smaller, requires Rust | Huge npm ecosystem |
| **Process Management** | Native, excellent | Good, platform quirks |
| **File I/O Performance** | Excellent | Good |
| **SQLite Performance** | Excellent (`rusqlite`) | Good (`better-sqlite3`) |

### When to Use Which

**Use Tauri when:**
- Bundle size is critical
- Memory usage is a concern
- You need maximum native performance
- WebView2 issues don't affect your users

**Use Electron when:**
- WebView2 stability issues occur
- You need consistent cross-platform rendering
- Development speed is prioritized
- Team is more familiar with Node.js

---

## Core Architecture

### Task Types

The application supports multiple task types organized into categories:

| Category | Tasks |
|----------|-------|
| File Operations | Copy, Move, Rename, Delete, Extract |
| Archives | Archive (combined Zip/Tar with format tabs) |
| Media | Transcode, Audio, Image, Thumbnail, Metadata |
| Sync & Transfer | Rsync, Rclone, FTP/SFTP, **Download** |
| Advanced | Shell Command, Script, HTTP Request |
| Flow Control | Filter, Wait, Branch |

### Task Executor Pattern

Each task type implements a common executor interface. Both backends follow the same pattern:

**Tauri (Rust):**
```rust
#[async_trait]
pub trait TaskExecutor: Send + Sync {
    async fn execute(
        &self,
        task: &Task,
        progress_tx: mpsc::Sender<TaskProgress>,
        cancel_token: CancellationToken,
    ) -> Result<TaskResult, TaskError>;
    
    fn task_type(&self) -> TaskType;
    fn validate_config(&self, config: &TaskConfig) -> Result<(), ValidationError>;
}
```

**Electron (TypeScript):**
```typescript
interface TaskExecutor {
  execute(
    task: Task,
    onProgress: (progress: TaskProgress) => void,
    abortSignal: AbortSignal,
  ): Promise<TaskResult>;
  
  taskType(): TaskType;
  validateConfig(config: TaskConfig): ValidationResult;
}
```

### Process Management Abstraction

Both backends need platform-aware process management for task killing:

```typescript
// shared/types.ts - Platform-agnostic interface
interface ProcessManager {
  spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess;
  kill(pid: number, force?: boolean): Promise<void>;
  isRunning(pid: number): boolean;
}
```

**Implementation Notes:**
- **Unix (macOS/Linux)**: Use `SIGTERM` for graceful, `SIGKILL` for force
- **Windows**: Use `taskkill /PID {pid}` or `taskkill /PID {pid} /F` for force

---

## Queue System

### Queue Model

```typescript
interface Queue {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'paused';
  maxParallel: number;  // Concurrent task limit
  created_at: string;
  updated_at: string;
}
```

### Task Model

```typescript
interface Task {
  id: string;
  queueId: string;
  type: TaskType;
  config: TaskConfig;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;  // 0-100
  bytesProcessed?: number;
  totalBytes?: number;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}
```

### Task Killing

Tasks can be killed mid-execution with proper cleanup:

1. Set cancellation token
2. Send SIGTERM to child process
3. Wait up to 2 seconds for graceful termination
4. Send SIGKILL if still running
5. Verify process termination
6. Clean up partial output files
7. Mark task as failed/cancelled
8. Auto-pause queue after kill (configurable)

---

## Workflow System

### Workflow Paradigms

The application supports two distinct workflow types:

1. **File Pipeline Workflows**: Files flow through a chain of tasks where each task's output becomes the next task's input. Triggered by manual file selection, directory batch processing, or file watching.

2. **Task Sequence Workflows**: Independent tasks with explicit input/output paths that run sequentially or in parallel (e.g., rsync multiple directories simultaneously).

### Workflow Model

```typescript
interface Workflow {
  id: string;
  name: string;
  type: 'file_pipeline' | 'task_sequence';
  status: 'idle' | 'running' | 'paused';
  
  trigger: {
    type: 'manual' | 'directory' | 'watch';
    path?: string;
    filePattern?: string;      // Glob: "*.mp4", "*.{jpg,png}"
    recursive?: boolean;
    maxDepth?: number;         // null = unlimited
    processExistingOnStart?: boolean;
    existingFilesNewerThan?: string;  // ISO date or null
  };
  
  execution: {
    mode: 'sequential' | 'parallel';
    maxParallel?: number;
  };
  
  output: {
    directory: string;
    nameTemplate: string;
  };
  
  tasks: WorkflowTaskDefinition[];
  
  recovery: {
    interruptedFiles: 'retry' | 'skip' | 'ask';
    checkMissedFiles: boolean;
  };
  
  watchOptions?: {
    ignoreTempFiles: boolean;
    tempPatterns: string[];    // [".tmp", ".part", ".crdownload", "~$*"]
    ignoreHiddenFiles: boolean;
    minFileSize?: number;      // bytes
  };
}

interface WorkflowTaskDefinition {
  id: string;
  type: TaskType;
  config: TaskConfig;
  onError: 'continue' | 'fail_file' | 'fail_file_and_pause';
}
```

### Workflow File Tracking

```typescript
interface WorkflowFile {
  id: string;
  workflowId: string;
  sourcePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
  taskStatuses: WorkflowFileTaskStatus[];
  added_at: string;
  started_at?: string;
  completed_at?: string;
}

interface WorkflowFileTaskStatus {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  bytesProcessed?: number;
  error?: string;
  started_at?: string;
  completed_at?: string;
}
```

### Pipeline Data Flow

For file pipeline workflows:

1. Input file enters the pipeline
2. Each task processes the file, outputting to a temp location
3. Output becomes input for the next task
4. Final task outputs to configured destination
5. Intermediate temp files are cleaned up after completion

**Copy Task Special Behavior**: Has `passThrough` option:
- `'original'`: Pass the original source file to next task
- `'copy'`: Pass the copied file to next task

**Output Template Variables**:
- `{filename}` - Original filename without extension
- `{ext}` - Original file extension
- `{date}` - Current date (YYYY-MM-DD)
- `{time}` - Current time (HH-MM-SS)
- `{index}` - Sequential number
- `{workflow}` - Workflow name
- `{domain}` - Domain extracted from URL (Download task only)

### Error Handling Strategies

Per-task configurable error handling:

| Strategy | Behavior |
|----------|----------|
| `continue` | Skip failed task, mark file "completed with errors", continue pipeline |
| `fail_file` | Stop pipeline for this file, mark as failed, other files unaffected |
| `fail_file_and_pause` | Stop pipeline for this file, pause entire workflow (in-progress files complete first) |

### Parallel File Processing

When execution mode is `parallel`:
- Each file processes through its full pipeline independently
- Multiple files can be at different pipeline stages simultaneously
- `maxParallel` controls how many files process at once
- A failure in one file's Task 2 does not affect other files at Task 2

---

## File Watching

### Backend Implementations

| Feature | Tauri (Rust) | Electron (Node.js) |
|---------|--------------|-------------------|
| **Library** | `notify` crate | `chokidar` |
| **Windows** | ReadDirectoryChangesW | ReadDirectoryChangesW |
| **macOS** | FSEvents | FSEvents |
| **Linux** | inotify | inotify |

Both implementations provide equivalent functionality with similar APIs.

### Watch Configuration

```typescript
interface WatchConfig {
  path: string;
  pattern: string;           // Glob pattern
  recursive: boolean;
  maxDepth?: number;         // Depth limit (null = unlimited)
  processExistingOnStart: boolean;
  newerThanFilter?: string;  // ISO date
  ignoreTempFiles: boolean;
  tempPatterns: string[];
  ignoreHiddenFiles: boolean;
  minFileSize?: number;
}
```

### File Stabilization

Before processing a detected file:

1. **Debounce**: Wait for file system events to settle (~500ms)
2. **Lock Check**: Verify file is not locked by another process
3. **Size Stability**: Confirm file size hasn't changed over 2-3 seconds
4. **Ready**: Add to processing queue

This ensures files are fully written before processing (important for large media files).

### Processed File Tracking

Track processed files in SQLite to avoid reprocessing:
- Store file path and optional hash
- Check against history when file detected
- Persists across application restarts

### Watch Scenarios Handled

| Scenario | Behavior |
|----------|----------|
| File created in watched folder | Detected and processed |
| File created in new subfolder | Subfolder auto-watched, file detected |
| File moved into watched folder | Detected as new file |
| File moved between subfolders | Detected in destination |
| Folder renamed | Continue watching under new name |
| Temporary files (.tmp, .part) | Ignored when temp filtering enabled |
| Hidden files | Ignored when hidden filtering enabled |
| File matches folder name | Ignored (only files processed) |

### Example: Nested Directory Watching

```
Watch Configuration:
  Path:      D:/Video
  Pattern:   *.{mkv,mp4,mov}
  Recursive: ✓

Directory Structure:
  D:/Video/
  ├── Video1/
  │   └── video.mkv       ← Detected ✓
  ├── Video2/
  │   └── project.mp4     ← Detected ✓
  ├── Tutorials/
  │   └── Photoshop/
  │       └── lesson1.mkv ← Detected ✓ (any depth)
  └── random.txt          ← Ignored (doesn't match pattern)
```

---

## Task Configuration Details

### Archive Task (Combined Zip/Tar)

Single task type with tabbed interface for format selection:

**Zip Options**:
- Compression: Store, Deflate, LZMA, Zstd
- Compression level: 1-9

**Tar Options**:
- Compression: None, Gzip, Bzip2, XZ, Zstd
- Compression level varies by algorithm

**CPU Usage Mode**:
- **Fast**: Uses `pigz` (parallel gzip) or multi-threaded compression, all available cores
- **Slow**: Single-threaded compression with nice priority (background-friendly)

### Transcode Task

**CPU Usage Mode** (only shown for CPU codecs):
- **Fast**: `-threads 0` (use all cores)
- **Slow**: `-threads 2` (limited threading)

**CPU Codecs** (show CPU usage option):
- libx264, libx265, libvpx-vp9, libaom-av1

**Hardware Codecs** (hide CPU usage option):
- h264_nvenc, hevc_nvenc (NVIDIA)
- h264_qsv, hevc_qsv (Intel QuickSync)
- h264_videotoolbox, hevc_videotoolbox (macOS)

### Download Task

Downloads files from URLs with configurable user contexts and headers.

**Features**:
- Single URL or list of URLs (text input or file, one URL per line)
- User context selection (browser simulation)
- Multiple header preset selection (merged in order)
- First-class authentication support (Basic Auth, Bearer Token, API Key)
- Resume partial downloads via Range headers
- Concurrent download limits
- Retry logic with configurable attempts
- Redirect following with depth limit
- Rate limiting (KB/s)

**Header Merge Order** (later overrides earlier):
1. User Context headers (base browser simulation)
2. Header Presets (in selection order)
3. Authentication headers (from auth config)
4. Custom headers (one-off additions)

### Common Task Properties

All tasks that support it include:
- `onError`: Error handling strategy for workflows
- Output path with template variable support

---

## Download Task Configuration

### Download Task Config Model

```typescript
interface DownloadTaskConfig {
  // Input
  urls: string[];                    // List of URLs
  urlListFile?: string;              // Or path to file containing URLs (one per line)
  
  // Context & Headers
  userContextId?: string;            // ID of user context (or null for none)
  headerPresetIds: string[];         // IDs of header presets (merged in order)
  customHeaders: Record<string, string>;  // One-off custom headers
  
  // Authentication
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'api_key';
    // For 'basic':
    username?: string;
    password?: string;
    // For 'bearer':
    token?: string;
    // For 'api_key':
    headerName?: string;             // e.g., "X-API-Key"
    apiKey?: string;
  };
  
  // Behavior
  followRedirects: boolean;          // Default: true
  maxRedirects: number;              // Default: 10
  timeout: number;                   // Seconds, 0 = no timeout. Default: 30
  retryAttempts: number;             // Default: 3
  retryDelay: number;                // Seconds between retries. Default: 5
  resumePartialDownloads: boolean;   // Use Range headers. Default: true
  
  // Concurrency (for multiple URLs)
  maxConcurrent: number;             // Default: 3
  
  // Output
  outputDirectory: string;
  outputTemplate: string;            // {filename}, {index}, {domain}, {date}, etc.
  overwriteExisting: 'skip' | 'overwrite' | 'rename';  // Default: 'skip'
  
  // Throttling
  rateLimit?: number;                // KB/s, 0 or null = unlimited
}
```

### User Context Model

User contexts simulate different browsers/devices by bundling common headers:

```typescript
interface UserContext {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;               // true for pre-made, false for user-created
  headers: {
    'User-Agent': string;
    'Accept': string;
    'Accept-Language': string;
    'Accept-Encoding': string;
    // Optional browser-specific headers
    'Sec-CH-UA'?: string;
    'Sec-CH-UA-Mobile'?: string;
    'Sec-CH-UA-Platform'?: string;
    'Sec-Fetch-Dest'?: string;
    'Sec-Fetch-Mode'?: string;
    'Sec-Fetch-Site'?: string;
    // Any additional headers
    [key: string]: string | undefined;
  };
}
```

### Built-In User Contexts

Loaded from a JSON config file (`user_contexts.json`) for easy updates:

| ID | Name | Description |
|----|------|-------------|
| `chrome-windows` | Chrome (Windows) | Latest Chrome on Windows 11 |
| `chrome-macos` | Chrome (macOS) | Latest Chrome on macOS |
| `firefox-windows` | Firefox (Windows) | Latest Firefox on Windows |
| `safari-macos` | Safari (macOS) | Latest Safari on macOS |
| `chrome-android` | Chrome Mobile (Android) | Chrome on Android phone |
| `safari-ios` | Safari Mobile (iOS) | Safari on iPhone |
| `curl` | curl | Minimal headers (like command-line curl) |

**Config File Location**: `{app_data}/config/user_contexts.json`

**Example `user_contexts.json`**:
```json
{
  "version": 1,
  "contexts": [
    {
      "id": "chrome-windows",
      "name": "Chrome (Windows)",
      "description": "Chrome 120 on Windows 11",
      "isBuiltIn": true,
      "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-CH-UA": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": "\"Windows\"",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      }
    },
    {
      "id": "curl",
      "name": "curl",
      "description": "Minimal headers like command-line curl",
      "isBuiltIn": true,
      "headers": {
        "User-Agent": "curl/8.4.0",
        "Accept": "*/*"
      }
    }
  ]
}
```

### Header Preset Model

Reusable header collections for authentication, cookies, and custom headers:

```typescript
interface HeaderPreset {
  id: string;
  name: string;
  description?: string;
  headers: Record<string, string>;   // Key-value pairs (can include cookies)
  created_at: string;
  updated_at: string;
}
```

**Example Use Cases**:
- API authentication (`Authorization: Bearer xxx`)
- Custom API keys (`X-API-Key: xxx`)
- Referer spoofing (`Referer: https://allowed-site.com`)
- Cookies (`Cookie: session=abc123; user=john`)
- Custom tracking headers

---

## Custom Task Templates

Users can create reusable task presets:

```typescript
interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  icon?: string;           // Emoji
  baseTask: TaskType;
  config: Partial<TaskConfig>;
  lockedFields: string[];  // Fields user cannot modify when using template
}
```

**Features**:
- Shown in "CUSTOM" category in Add Task dialog
- Template editor with field locking (🔒 icon on locked fields)
- Can lock any combination of fields
- Stored in SQLite

**Example Templates**:
- "YouTube 1080p" - Transcode with specific settings locked
- "Web Optimized Images" - Image task with quality/format preset
- "Backup Archive" - Archive with specific compression settings

---

## Dependency Management

### External Dependencies

```typescript
const dependencies = {
  ffmpeg: {
    binary: 'ffmpeg',
    checkCommand: 'ffmpeg -version',
    required: true,
    usedBy: ['transcode', 'audio', 'thumbnail']
  },
  rsync: {
    binary: 'rsync',
    checkCommand: 'rsync --version',
    required: false,
    usedBy: ['rsync']
  },
  rclone: {
    binary: 'rclone',
    checkCommand: 'rclone version',
    required: false,
    usedBy: ['rclone']
  },
  pigz: {
    binary: 'pigz',
    checkCommand: 'pigz --version',
    required: false,  // Falls back to gzip
    usedBy: ['archive']
  },
  imagemagick: {
    binary: 'magick',
    checkCommand: 'magick --version',
    required: false,
    usedBy: ['image', 'thumbnail']
  },
  exiftool: {
    binary: 'exiftool',
    checkCommand: 'exiftool -ver',
    required: false,
    usedBy: ['metadata']
  }
};
```

### Dependency Detection

1. Check for binary availability on startup
2. Show popup with platform-specific install instructions if required dependency missing
3. "Check Again" button to re-verify after installation
4. Optional dependencies (e.g., pigz) fall back gracefully with warning
5. Disable task types that require missing dependencies

---

## Database Schema

Both backends use SQLite with identical schema. The database libraries differ:

| Backend | Library | Notes |
|---------|---------|-------|
| Tauri (Rust) | `rusqlite` | Synchronous, excellent performance |
| Electron (Node.js) | `better-sqlite3` | Synchronous, native bindings |

**Database Location**: `{app_data}/task-queue-manager/data.db`

### Core Tables

```sql
-- Queues
CREATE TABLE queues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle',
    max_parallel INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Tasks
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    config TEXT NOT NULL,  -- JSON
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    bytes_processed INTEGER,
    total_bytes INTEGER,
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);
```

### Workflow Tables

```sql
-- Workflows
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'file_pipeline' or 'task_sequence'
    status TEXT NOT NULL DEFAULT 'idle',
    trigger_type TEXT NOT NULL,
    trigger_path TEXT,
    trigger_pattern TEXT,
    trigger_recursive INTEGER DEFAULT 0,
    trigger_max_depth INTEGER,
    trigger_process_existing INTEGER DEFAULT 0,
    trigger_newer_than TEXT,
    execution_mode TEXT NOT NULL DEFAULT 'sequential',
    execution_max_parallel INTEGER DEFAULT 1,
    output_directory TEXT,
    output_name_template TEXT,
    recovery_interrupted TEXT DEFAULT 'ask',
    recovery_check_missed INTEGER DEFAULT 1,
    watch_ignore_temp INTEGER DEFAULT 1,
    watch_temp_patterns TEXT,  -- JSON array
    watch_ignore_hidden INTEGER DEFAULT 1,
    watch_min_file_size INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Workflow Task Definitions
CREATE TABLE workflow_tasks (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    task_type TEXT NOT NULL,
    config TEXT NOT NULL,  -- JSON
    on_error TEXT NOT NULL DEFAULT 'fail_file',
    created_at TEXT NOT NULL
);

-- Files Being Processed by Workflows
CREATE TABLE workflow_files (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    source_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    added_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);

-- Per-Task Status for Each File
CREATE TABLE workflow_file_tasks (
    id TEXT PRIMARY KEY,
    workflow_file_id TEXT NOT NULL REFERENCES workflow_files(id) ON DELETE CASCADE,
    workflow_task_id TEXT NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    bytes_processed INTEGER,
    started_at TEXT,
    completed_at TEXT
);

-- History of Processed Files (for watch deduplication)
CREATE TABLE workflow_processed_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT,
    processed_at TEXT NOT NULL,
    UNIQUE(workflow_id, file_path)
);

-- Custom Task Templates
CREATE TABLE task_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    base_task TEXT NOT NULL,
    config TEXT NOT NULL,  -- JSON
    locked_fields TEXT,    -- JSON array
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### Download Presets Tables

```sql
-- User-Created User Contexts (built-in loaded from JSON file)
CREATE TABLE user_contexts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    headers TEXT NOT NULL,           -- JSON object
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Header Presets
CREATE TABLE header_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    headers TEXT NOT NULL,           -- JSON object
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

---

## Application Startup Behavior

### Global Settings

```typescript
interface AppSettings {
  // General
  pauseAllOnStartup: boolean;        // Safety mode: start with everything paused
  theme: 'light' | 'dark' | 'system';
  
  // Download Defaults
  downloadDefaults: {
    defaultUserContextId?: string;   // Default user context for new downloads
    defaultHeaderPresetIds: string[];// Default header presets for new downloads
    defaultTimeout: number;          // Default: 30
    defaultRetryAttempts: number;    // Default: 3
    defaultMaxConcurrent: number;    // Default: 3
  };
}
```

### Startup Sequence

1. Initialize database connection
2. Check external dependencies
3. Load app settings
4. Load built-in user contexts from `user_contexts.json`
5. If `pauseAllOnStartup` is false:
   - Resume watchers for workflows that were active
   - Apply per-workflow `interruptedFiles` recovery strategy
   - Optionally check for files added while app was closed
6. If `pauseAllOnStartup` is true:
   - All queues and workflows start paused
   - User must manually resume

---

## User Interface

### Main Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  Task Queue Manager                                    [─] [□] [×]     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐  ┌─────────────────────────────────────────────────┐ │
│  │              │  │                                                 │ │
│  │  ▼ QUEUES    │  │           Main Content Area                     │ │
│  │              │  │                                                 │ │
│  │  [Queue 1]   │  │  (Shows selected queue or workflow details)     │ │
│  │  [Queue 2]   │  │                                                 │ │
│  │  [+ New]     │  │                                                 │ │
│  │              │  │                                                 │ │
│  │  ▼ WORKFLOWS │  │                                                 │ │
│  │              │  │                                                 │ │
│  │  🔵 Pipeline │  │                                                 │ │
│  │  🟢 Sequence │  │                                                 │ │
│  │  [+ New ▼]   │  │                                                 │ │
│  │    ○ File    │  │                                                 │ │
│  │      Pipeline│  │                                                 │ │
│  │    ○ Task    │  │                                                 │ │
│  │      Sequence│  │                                                 │ │
│  │              │  │                                                 │ │
│  │  ▼ HISTORY   │  │                                                 │ │
│  │              │  │                                                 │ │
│  └──────────────┘  └─────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Sidebar Components

**Queue Card**:
```
┌─────────────────────────────┐
│ Queue Name           ● Idle │
│ 3 pending • 1 running       │
└─────────────────────────────┘
```

**Workflow Card**:
```
┌─────────────────────────────┐
│ 🔵 Video Processing  ● Watch│
│ 5 files • 2 processing      │
└─────────────────────────────┘
```

### Workflow Editor (Main Panel)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Workflow: Video Processing                    [▶ Start] [⏸ Pause] [⚙]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ Trigger ─────────────────────┐  ┌─ File Queue ────────────────────┐ │
│  │                               │  │                                 │ │
│  │  Type: [Watch ▼]              │  │  ┌─────────────────────────────┐│ │
│  │                               │  │  │ video1.mkv     [████████▒▒] ││ │
│  │  Watch Folder: [D:/Video] [📁]│  │  │ Task 2/3: Transcode    80%  ││ │
│  │  Pattern: [*.{mkv,mp4}     ]  │  │  └─────────────────────────────┘│ │
│  │                               │  │  ┌─────────────────────────────┐│ │
│  │  [✓] Include subfolders       │  │  │ video2.mp4     [██████████] ││ │
│  │  [ ] Process existing on start│  │  │ Completed               ✓   ││ │
│  │                               │  │  └─────────────────────────────┘│ │
│  └───────────────────────────────┘  │  ┌─────────────────────────────┐│ │
│                                     │  │ video3.mkv     [▒▒▒▒▒▒▒▒▒▒] ││ │
│  ┌─ Pipeline ────────────────────┐  │  │ Pending                     ││ │
│  │                               │  │  └─────────────────────────────┘│ │
│  │  ┌─────────────────────────┐  │  │                                 │ │
│  │  │ 1. 📋 Copy              │  │  │                                 │ │
│  │  │    → Backup folder      │  │  │                                 │ │
│  │  │    On Error: Continue   │  │  │                                 │ │
│  │  └─────────────────────────┘  │  │                                 │ │
│  │           ↓                   │  │                                 │ │
│  │  ┌─────────────────────────┐  │  │                                 │ │
│  │  │ 2. 🎬 Transcode         │  │  │                                 │ │
│  │  │    H.264, CRF 23        │  │  │                                 │ │
│  │  │    On Error: Fail file  │  │  │                                 │ │
│  │  └─────────────────────────┘  │  │                                 │ │
│  │           ↓                   │  │                                 │ │
│  │  ┌─────────────────────────┐  │  │                                 │ │
│  │  │ 3. 📦 Archive           │  │  │                                 │ │
│  │  │    Zip, Deflate         │  │  │                                 │ │
│  │  │    On Error: Fail file  │  │  │                                 │ │
│  │  └─────────────────────────┘  │  │                                 │ │
│  │                               │  │                                 │ │
│  │  [+ Add Task]                 │  │                                 │ │
│  │                               │  │                                 │ │
│  └───────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                         │
│  Output: [D:/Processed/{filename}_processed.{ext}                 ] [📁]│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Add Task Dialog

```
┌─ Add Task ─────────────────────────────────────────────────────────────┐
│                                                                         │
│  [🔍 Search tasks...                                              ]     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  CUSTOM                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                          │
│  │ 🎬         │ │ 🖼️         │ │ ➕         │                          │
│  │ YouTube    │ │ Web Images │ │ Create New │                          │
│  │ 1080p      │ │            │ │            │                          │
│  └────────────┘ └────────────┘ └────────────┘                          │
│                                                                         │
│  FILE OPERATIONS                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ 📋         │ │ 📁         │ │ ✏️         │ │ 🗑️         │           │
│  │ Copy       │ │ Move       │ │ Rename     │ │ Delete     │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
│  ┌────────────┐                                                         │
│  │ 📂         │                                                         │
│  │ Extract    │                                                         │
│  └────────────┘                                                         │
│                                                                         │
│  ARCHIVES                                                               │
│  ┌────────────┐                                                         │
│  │ 📦         │                                                         │
│  │ Archive    │                                                         │
│  └────────────┘                                                         │
│                                                                         │
│  MEDIA                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ 🎬         │ │ 🎵         │ │ 🖼️         │ │ 🖼️         │           │
│  │ Transcode  │ │ Audio      │ │ Image      │ │ Thumbnail  │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
│  ┌────────────┐                                                         │
│  │ 🏷️         │                                                         │
│  │ Metadata   │                                                         │
│  └────────────┘                                                         │
│                                                                         │
│  SYNC & TRANSFER                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ 🔄         │ │ ☁️         │ │ 📡         │ │ ⬇️         │           │
│  │ Rsync      │ │ Rclone     │ │ FTP/SFTP   │ │ Download   │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
│                                                                         │
│  ADVANCED                                                               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                          │
│  │ 💻         │ │ 📜         │ │ 🌐         │                          │
│  │ Shell      │ │ Script     │ │ HTTP       │                          │
│  │ Command    │ │            │ │ Request    │                          │
│  └────────────┘ └────────────┘ └────────────┘                          │
│                                                                         │
│  FLOW CONTROL                                                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                          │
│  │ 🔍         │ │ ⏱️         │ │ 🔀         │                          │
│  │ Filter     │ │ Wait       │ │ Branch     │                          │
│  └────────────┘ └────────────┘ └────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Task Configuration Panel Examples

**Archive Task**:
```
┌─ Archive Task ────────────────────────────────────────────────────┐
│                                                                       │
│  Format:  ┌─────────┬─────────┐                                       │
│           │   ZIP   │   TAR   │                                       │
│           └─────────┴─────────┘                                       │
│                                                                       │
│  Compression:  [Deflate           ▼]                                  │
│  Level:        ├────────●────────┤  6                                 │
│                                                                       │
│  CPU Usage:    ○ Fast (all cores)                                     │
│                ● Slow (background)                                    │
│                                                                       │
│  Output:       [{filename}.zip                              ] [📁]    │
│                                                                       │
│  On Error:     [Fail file ▼]                                          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

**Transcode Task** (with CPU codec):
```
┌─ Transcode Task ──────────────────────────────────────────────────┐
│                                                                       │
│  Video Codec:  [libx264 (H.264)                            ▼]         │
│  Preset:       [medium                                     ▼]         │
│  Quality:      ├────────●────────┤  CRF 23                            │
│                                                                       │
│  Audio Codec:  [aac                                        ▼]         │
│  Audio Bitrate:[192k                                       ▼]         │
│                                                                       │
│  CPU Usage:    ○ Fast (all cores)                                     │
│                ● Slow (limited)                                       │
│                                                                       │
│  Output:       [{filename}_transcoded.mp4                   ] [📁]    │
│                                                                       │
│  On Error:     [Fail file ▼]                                          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

**Download Task**:
```
┌─ Download Task ───────────────────────────────────────────────────┐
│                                                                       │
│  URLs:  ● Enter URLs    ○ Load from file                              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐      │
│  │ https://example.com/file1.zip                               │      │
│  │ https://example.com/file2.zip                               │      │
│  │ https://example.com/file3.zip                               │      │
│  └─────────────────────────────────────────────────────────────┘      │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│  Request Settings                                                     │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  User Context:    [Chrome (Windows)              ▼] [⚙️ Manage]        │
│                                                                       │
│  Header Presets:  ┌─────────────────────────────────────────────┐     │
│                   │ ☑ My API Auth                               │     │
│                   │ ☐ Referer Spoofing                          │     │
│                   │ ☐ Session Cookies                           │     │
│                   └─────────────────────────────────────────────┘     │
│                   [⚙️ Manage Presets]                                  │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│  Authentication                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  Type:  ● None  ○ Basic Auth  ○ Bearer Token  ○ API Key               │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│  Custom Headers                                              [+ Add]  │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  [🗑️]     │
│  │ X-Custom-Header      │  │ custom-value                 │           │
│  └──────────────────────┘  └──────────────────────────────┘           │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│  Download Options                                                     │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  [✓] Follow redirects     Max: [10]                                   │
│  [✓] Resume partial downloads                                         │
│  [ ] Rate limit           [____] KB/s                                 │
│                                                                       │
│  Timeout:        [30] seconds                                         │
│  Retry attempts: [3]                                                  │
│  Concurrent:     [3] downloads                                        │
│                                                                       │
│  If file exists: [Skip ▼]                                             │
│                                                                       │
│  Output:  [D:/Downloads/{filename}                        ] [📁]      │
│                                                                       │
│  On Error:  [Fail file ▼]                                             │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

**Download Task - Basic Auth Selected**:
```
│  ───────────────────────────────────────────────────────────────────  │
│  Authentication                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  Type:  ○ None  ● Basic Auth  ○ Bearer Token  ○ API Key               │
│                                                                       │
│  Username:  [admin                                         ]          │
│  Password:  [••••••••                                      ] [👁]     │
│                                                                       │
```

**Download Task - Bearer Token Selected**:
```
│  ───────────────────────────────────────────────────────────────────  │
│  Authentication                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  Type:  ○ None  ○ Basic Auth  ● Bearer Token  ○ API Key               │
│                                                                       │
│  Token:  [eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...       ] [👁]        │
│                                                                       │
```

**Download Task - API Key Selected**:
```
│  ───────────────────────────────────────────────────────────────────  │
│  Authentication                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  Type:  ○ None  ○ Basic Auth  ○ Bearer Token  ● API Key               │
│                                                                       │
│  Header Name:  [X-API-Key                                  ]          │
│  API Key:      [sk_live_abc123def456...                    ] [👁]     │
│                                                                       │
```

**Watch Trigger Configuration**:
```
┌─ Trigger Configuration ───────────────────────────────────────────┐
│                                                                       │
│  Type:  ○ Manual                                                      │
│         ○ Directory (process existing files)                          │
│         ● Watch (auto-process new files)                              │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  Watch Folder:  [D:/Video                                   ] [📁]    │
│                                                                       │
│  File Pattern:  [*.{mkv,mp4,mov,avi}                        ]         │
│                 Examples: *.mp4, *.{jpg,png}, video_*                 │
│                                                                       │
│  [✓] Include subfolders                                               │
│      └─ Depth: [Unlimited ▼]                                          │
│                                                                       │
│  [ ] Process existing files on start                                  │
│      └─ Only files newer than: [Don't filter ▼]                       │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│  Advanced Options                                                     │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  [✓] Ignore temporary files                                           │
│      Patterns: .tmp, .part, .crdownload, ~$*                          │
│                                                                       │
│  [✓] Ignore hidden files                                              │
│                                                                       │
│  [ ] Ignore files smaller than: [___] MB                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Settings - Download Presets

```
┌─ Settings ──────────────────────────────────────────────────────────┐
│                                                                       │
│  ▼ General                                                            │
│    [✓] Pause all on startup                                           │
│    Theme: [System ▼]                                                  │
│                                                                       │
│  ▼ Download Presets                                                   │
│                                                                       │
│    ┌─ User Contexts ──────────────────────────────────────────────┐   │
│    │                                                      [+ Add] │   │
│    │ ───────────────────────────────────────────────────────────  │   │
│    │ 🔒 Chrome (Windows)         Built-in                         │   │
│    │ 🔒 Chrome (macOS)           Built-in                         │   │
│    │ 🔒 Firefox (Windows)        Built-in                         │   │
│    │ 🔒 Safari (macOS)           Built-in                         │   │
│    │ 🔒 Chrome Mobile (Android)  Built-in                         │   │
│    │ 🔒 Safari Mobile (iOS)      Built-in                         │   │
│    │ 🔒 curl                     Built-in                         │   │
│    │    My Custom Bot            User-defined         [✏️] [🗑️]   │   │
│    └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│    ┌─ Header Presets ─────────────────────────────────────────────┐   │
│    │                                                      [+ Add] │   │
│    │ ───────────────────────────────────────────────────────────  │   │
│    │    My API Auth              Authorization: Bear… [✏️] [🗑️]   │   │
│    │    Work Proxy Headers       X-Forwarded-For...   [✏️] [🗑️]   │   │
│    │    Session Cookies          Cookie: session=...  [✏️] [🗑️]   │   │
│    └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│    Default User Context:  [None ▼]                                    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### User Context Editor Dialog

```
┌─ Edit User Context ─────────────────────────────────────────────────┐
│                                                                       │
│  Name:         [My Custom Bot                              ]          │
│  Description:  [Custom scraper user agent                  ]          │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│  Headers                                                     [+ Add]  │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  User-Agent                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ MyBot/1.0 (compatible; CustomCrawler)                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Accept                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ text/html,application/xhtml+xml,*/*                             │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Accept-Language                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ en-US,en;q=0.9                                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Accept-Encoding                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ gzip, deflate                                                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  [🗑️]    │
│  │ X-Custom-Header      │  │ custom-value                 │          │
│  └──────────────────────┘  └──────────────────────────────┘          │
│                                                                       │
│                                           [Cancel]  [Save]            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Header Preset Editor Dialog

```
┌─ Edit Header Preset ────────────────────────────────────────────────┐
│                                                                       │
│  Name:         [My API Auth                                ]          │
│  Description:  [Bearer token for internal API              ]          │
│                                                                       │
│  ───────────────────────────────────────────────────────────────────  │
│  Headers                                                     [+ Add]  │
│  ───────────────────────────────────────────────────────────────────  │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  [🗑️]    │
│  │ Authorization        │  │ Bearer eyJhbGciOiJIUzI1N...  │          │
│  └──────────────────────┘  └──────────────────────────────┘          │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────────────┐  [🗑️]    │
│  │ Cookie               │  │ session=abc123; user=john   │          │
│  └──────────────────────┘  └──────────────────────────────┘          │
│                                                                       │
│                                           [Cancel]  [Save]            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Event System

### Tauri Event Types

```typescript
// Backend → Frontend events
type TaskProgressEvent = {
  taskId: string;
  progress: number;
  bytesProcessed?: number;
  totalBytes?: number;
  status: TaskStatus;
};

type QueueStatusEvent = {
  queueId: string;
  status: QueueStatus;
  runningCount: number;
  pendingCount: number;
};

type WorkflowStatusEvent = {
  workflowId: string;
  status: WorkflowStatus;
  activeFiles: number;
  pendingFiles: number;
};

type WorkflowFileEvent = {
  workflowId: string;
  fileId: string;
  sourcePath: string;
  status: WorkflowFileStatus;
  currentTask?: string;
  progress?: number;
};

type FileDetectedEvent = {
  workflowId: string;
  filePath: string;
  fileSize: number;
};

type DependencyStatusEvent = {
  dependency: string;
  available: boolean;
  version?: string;
}};

type DownloadProgressEvent = {
  taskId: string;
  urlIndex: number;
  url: string;
  bytesDownloaded: number;
  totalBytes?: number;        // null if Content-Length unknown
  speed: number;              // bytes/sec
  status: 'downloading' | 'completed' | 'failed' | 'retrying';
  error?: string;
};
```

---

## WebView2 Stability (Windows) - Tauri Only

When using the Tauri backend on Windows, WebView2 can experience freezes after monitor sleep or power state changes. To mitigate this, spawn WebView window creation on a separate thread:

```rust
// In Tauri setup, spawn WebView creation on separate thread
tauri::Builder::default()
    .setup(|app| {
        let app_handle = app.handle().clone();
        std::thread::spawn(move || {
            WebviewWindowBuilder::new(
                &app_handle,
                "main",
                WebviewUrl::default()
            )
            .title("Task Queue Manager")
            .inner_size(1200.0, 800.0)
            .build()
            .expect("Failed to create window");
        });
        Ok(())
    })
```

This prevents the main thread from blocking during Windows power state transitions.

**Note:** If WebView2 issues persist, the dual-backend architecture allows switching to the Electron backend, which bundles its own Chromium and does not have these issues.

### Frontend Recovery (Both Backends)

Add event listeners to detect and recover from visibility changes:

```typescript
// packages/frontend/src/hooks/useVisibilityRecovery.ts

import { useEffect } from 'react';
import { useBridge } from '../api/bridge';

export function useVisibilityRecovery(onRecover: () => void) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onRecover();
      }
    };

    const handleFocus = () => {
      onRecover();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [onRecover]);
}
```

---

## Summary

This specification defines a desktop task queue manager with:

1. **Dual-Backend Architecture**: Shared React frontend with swappable Tauri (Rust) or Electron (Node.js) backends
2. **Backend Abstraction Layer**: Unified bridge interface allowing seamless backend switching
3. **Flexible Queue System**: Manual task queuing with parallel execution control
4. **Powerful Workflow Engine**: File pipelines and task sequences with multiple trigger types
5. **Robust File Watching**: Recursive directory monitoring with stabilization and deduplication
6. **Extensible Task Types**: 16+ built-in tasks across file, archive, media, sync, and flow control categories
7. **Download Task**: URL downloading with user context simulation, header presets, and authentication support
8. **Custom Templates**: User-definable task presets with field locking
9. **Dependency Management**: Automatic detection with platform-specific install guidance
10. **Comprehensive Error Handling**: Per-task strategies with workflow-level recovery options
11. **Real-time Progress**: Event-driven UI updates with per-file, per-task status tracking
