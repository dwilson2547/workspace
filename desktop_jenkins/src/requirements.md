# Desktop Task Manager - Requirements Specification

## Overview

A desktop application for managing and automating repetitive file and directory operations through a flexible task execution system. The application organizes work into three core building blocks: **Tasks**, **Queues**, and **Workflows**.

---

## Technology Stack

### Recommended Stack (Electron)

- **Frontend**: React with TypeScript
- **Backend**: Electron with Node.js
- **Database**: SQLite (`better-sqlite3`)
- **File Watching**: `chokidar`
- **Process Management**: Node.js `child_process`

### Alternative Stacks

- **NW.js**: Similar to Electron, smaller bundle size
- **Neutralino**: Lightweight, uses system webview
- **Native**: Qt (C++/Python), .NET MAUI (C#), or JavaFX (Java)

**Note**: Tauri is explicitly excluded due to past development difficulties.

---

## Core Concepts

### 1. Tasks

**Tasks** are individual file or directory operations that can be executed independently or as part of a queue/workflow.

#### Task Types

**File Operations**:
- Copy
- Move
- Rename
- Delete
- Change Permissions (chmod/chown)

**Sync & Transfer**:
- Rsync
- Rclone
- FTP/SFTP
- HTTP Download

**Media Processing**:
- Transcode (video/audio)
- Image conversion/resize
- Thumbnail generation
- Metadata extraction/modification

**Archives**:
- Create archive (zip, tar, tar.gz, etc.)
- Extract archive

**Advanced**:
- Shell command execution
- Script execution (bash, python, etc.)
- Custom plugins

#### Task Configuration

Each task type has specific configuration options:

```typescript
interface Task {
  id: string;
  type: TaskType;
  name: string;
  config: TaskConfig;  // Type-specific configuration
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;    // 0-100
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

---

### 2. Queues

**Queues** are collections of tasks meant for **one-time execution**. Users manually add tasks to a queue and execute them when ready.

#### Queue Behavior

- **Default State**: Paused on application startup
- **Execution Model**: Tasks execute in **series** (one after another)
- **Completion**: Queue automatically pauses when all tasks complete
- **Parallelism**: Multiple queues can run **in parallel** if started simultaneously
- **Manual Control**: Users explicitly start/pause/stop queues

#### Queue Model

```typescript
interface Queue {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  status: 'paused' | 'running' | 'completed';
  currentTaskIndex: number;
  createdAt: string;
  updatedAt: string;
}
```

#### Queue Operations

- **Create Queue**: Initialize a new empty queue
- **Add Task**: Manually add task to queue
- **Remove Task**: Remove task from queue (only if not running)
- **Reorder Tasks**: Drag-and-drop or move up/down
- **Start Queue**: Begin executing tasks in order
- **Pause Queue**: Pause after current task completes
- **Stop Queue**: Cancel current task and pause
- **Delete Queue**: Remove queue and all tasks

---

### 3. Workflows

**Workflows** are **persistent collections of tasks** designed to process multiple files through the same sequence of operations.

#### Workflow Characteristics

- **Persistent**: Workflows are saved and remain available across application sessions
- **Task Pipeline**: Execute the same series of tasks against each file
- **Sequential Per-File**: For each file, tasks execute in order (Task 1 → Task 2 → Task 3)
- **Threading Options**: 
  - **Single-threaded**: Process one file at a time
  - **Parallel**: Process multiple files simultaneously (configurable max parallel)

#### Workflow Model

```typescript
interface Workflow {
  id: string;
  name: string;
  description?: string;
  tasks: WorkflowTask[];  // Task templates
  executionMode: 'sequential' | 'parallel';
  maxParallel?: number;   // Only for parallel mode
  fileQueue: WorkflowFile[];
  status: 'idle' | 'running' | 'paused';
  createdAt: string;
  updatedAt: string;
}

interface WorkflowTask {
  id: string;
  type: TaskType;
  config: TaskConfig;
  order: number;
  onError: 'stop' | 'skip' | 'continue';  // Error handling strategy
}

interface WorkflowFile {
  id: string;
  filePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentTaskIndex: number;
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
```

#### Adding Files to Workflows

Workflows support three methods for adding files to the processing queue:

##### Option 1: Manual Selection

Users manually select files or directories to add to the workflow queue.

**File Selection**:
- Single file picker
- Multiple file picker

**Directory Selection**:
- **Non-recursive** (default): Only direct children of the directory are added
- **Recursive**: When recursive flag is enabled, scan all subdirectories and add all matching files

```typescript
interface ManualSelectionConfig {
  selectionType: 'file' | 'directory';
  recursive?: boolean;  // Only for directory selection
  filter?: FileFilter;  // Optional: filter by extension, pattern, etc.
}

interface FileFilter {
  extensions?: string[];      // e.g., ['.mp4', '.mkv']
  pattern?: string;            // Glob pattern
  minSize?: number;            // Bytes
  maxSize?: number;            // Bytes
}
```

##### Option 2: Directory Watcher (Automated Scanner)

Automatically monitor a directory for new files and add them to the workflow queue once they're fully written.

**Watcher Features**:
- Watch a specific directory path
- Optionally watch subdirectories (recursive)
- Filter by file extension (e.g., only `.mp4`, `.mkv`)
- Filter by filename pattern (glob or regex)
- **Ignore Existing Files**: Option to only process files created after watcher starts
- File stability detection (wait for file to finish copying)

```typescript
interface DirectoryWatcherConfig {
  enabled: boolean;
  watchPath: string;
  recursive: boolean;
  filters: {
    extensions?: string[];         // e.g., ['.mp4', '.mkv', '.avi']
    filenamePattern?: string;       // Glob or regex pattern
    ignoreHidden?: boolean;         // Ignore files starting with '.'
    minSize?: number;               // Minimum file size in bytes
  };
  ignoreExisting: boolean;          // If true, don't process files that exist when watcher starts
  stabilityDelay: number;           // Wait time (ms) to ensure file is fully copied
}
```

**File Stability Detection**:

Before adding a detected file to the queue, the watcher should verify the file is fully written:

1. **Debounce**: Wait for file system events to settle (~500ms)
2. **Size Stability**: Check file size multiple times over a period (e.g., every 1s for 3s)
3. **Lock Check** (optional): Attempt to open file for reading to verify it's not locked
4. **Ready**: Once stable, add to workflow queue

##### Option 3: Batch Import

Import a list of file paths from a text file (one path per line) or JSON array.

```typescript
interface BatchImportConfig {
  source: 'text-file' | 'json-file' | 'clipboard';
  filePath?: string;  // For file-based import
  filter?: FileFilter;
}
```

#### Workflow Execution

**Sequential Mode** (Single-threaded):
```
File 1: Task 1 → Task 2 → Task 3 → Done
File 2: Task 1 → Task 2 → Task 3 → Done
File 3: Task 1 → Task 2 → Task 3 → Done
```

**Parallel Mode** (Multi-threaded):
```
File 1: Task 1 → Task 2 → Task 3 → Done
File 2:   Task 1 → Task 2 → Task 3 → Done
File 3:     Task 1 → Task 2 → Task 3 → Done
File 4:       Task 1 → Task 2 → Task 3 → Done
```

**Error Handling**:
- `stop`: Stop workflow entirely if task fails
- `skip`: Skip this file, continue with next file
- `continue`: Mark file as "completed with errors", continue workflow

---

## Data Persistence

### Database Schema (SQLite)

```sql
-- Queues
CREATE TABLE queues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    current_task_index INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Tasks (both queue and workflow tasks)
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    queue_id TEXT,
    workflow_id TEXT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,  -- JSON
    status TEXT NOT NULL,
    progress INTEGER,
    error TEXT,
    task_order INTEGER,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Workflows
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    execution_mode TEXT NOT NULL,
    max_parallel INTEGER,
    status TEXT NOT NULL,
    watcher_config TEXT,  -- JSON
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Workflow File Queue
CREATE TABLE workflow_files (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL,
    current_task_index INTEGER DEFAULT 0,
    error TEXT,
    added_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Processed Files History (for watcher deduplication)
CREATE TABLE processed_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    UNIQUE(workflow_id, file_path),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
```

---

## User Interface

### Main Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Task Manager                              [─] [□] [×]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌────────────────────────────────────────┐ │
│  │             │  │                                        │ │
│  │  QUEUES     │  │        Main Content Area              │ │
│  │             │  │                                        │ │
│  │  Queue 1    │  │  (Shows queue or workflow detail)      │ │
│  │  Queue 2    │  │                                        │ │
│  │  [+ New]    │  │                                        │ │
│  │             │  │                                        │ │
│  │  WORKFLOWS  │  │                                        │ │
│  │             │  │                                        │ │
│  │  Workflow 1 │  │                                        │ │
│  │  Workflow 2 │  │                                        │ │
│  │  [+ New]    │  │                                        │ │
│  │             │  │                                        │ │
│  └─────────────┘  └────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Queue View

Shows list of tasks in the queue with drag-and-drop reordering:

```
┌─ Queue: Video Backup ───────────────────────────────────────┐
│                                                             │
│  Status: Paused          [▶ Start] [⏸ Pause] [⏹ Stop]      │
│                                                             │
│  Tasks (3):                                    [+ Add Task] │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Copy                                      ⋮        │  │
│  │    /home/user/videos → /backup/videos                │  │
│  │    Status: Pending                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. Transcode                                 ⋮        │  │
│  │    H.264 → H.265, CRF 23                             │  │
│  │    Status: Pending                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. Delete                                    ⋮        │  │
│  │    Remove originals                                   │  │
│  │    Status: Pending                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Workflow View

Shows workflow configuration and file queue:

```
┌─ Workflow: Video Processing ───────────────────────────────┐
│                                                             │
│  Status: Running         [▶ Start] [⏸ Pause] [⚙ Settings]  │
│  Mode: Parallel (4 threads)                                 │
│                                                             │
│  ┌─ Task Pipeline ──────────────────────────────────────┐  │
│  │                                                       │  │
│  │  1. Transcode → H.265, CRF 23                        │  │
│  │  2. Create Thumbnail → 320x180 JPG                   │  │
│  │  3. Delete Original                                  │  │
│  │                                      [Edit Pipeline]  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ File Queue ─────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  [+ Add Files] [+ Add Folder] [📁 Watch Directory]    │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────┐     │  │
│  │  │ video1.mp4              [████████░░]  80%   │     │  │
│  │  │ Task 2/3: Create Thumbnail                  │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  │  ┌─────────────────────────────────────────────┐     │  │
│  │  │ video2.mkv              [██████████] ✓      │     │  │
│  │  │ Completed                                   │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  │  ┌─────────────────────────────────────────────┐     │  │
│  │  │ video3.mp4              [░░░░░░░░░░]        │     │  │
│  │  │ Pending                                     │     │  │
│  │  └─────────────────────────────────────────────┘     │  │
│  │                                                       │  │
│  │  Showing 3 of 15 files                                │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Directory Watcher ──────────────────────────────────┐  │
│  │  ✓ Enabled                                           │  │
│  │  Path: /home/user/downloads/videos                   │  │
│  │  Filter: *.mp4, *.mkv                                │  │
│  │  Ignore existing: Yes                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Application Startup Behavior

### On Application Launch

1. **Load Database**: Open SQLite database connection
2. **Restore State**: 
   - Load all saved queues (status: paused)
   - Load all saved workflows (status: idle)
3. **Queues**: All queues start in **paused** state
4. **Workflows**: 
   - Workflows start in **idle** state
   - Directory watchers are **not** automatically started
   - User must manually start workflows or enable watchers
5. **Show Dashboard**: Display main interface with all queues and workflows

### Settings Option

Provide a setting to control startup behavior:
- "Auto-resume workflows on startup" (default: off)
- "Auto-start directory watchers on startup" (default: off)

---

## Implementation Notes

### Process Management

For executing external commands (rsync, ffmpeg, etc.):
- Use Node.js `child_process.spawn()` or `exec()`
- Capture stdout/stderr for progress tracking
- Support cancellation via process.kill()
- Handle platform differences (Windows vs Unix)

### File Watching

Use `chokidar` library for reliable cross-platform file watching:
```javascript
const chokidar = require('chokidar');

const watcher = chokidar.watch(watchPath, {
  ignored: /(^|[\/\\])\../, // Ignore hidden files
  persistent: true,
  ignoreInitial: ignoreExisting
});

watcher.on('add', (path) => {
  // File added, check stability then add to queue
});
```

### Database Access

Use `better-sqlite3` for synchronous, fast SQLite access:
```javascript
const Database = require('better-sqlite3');
const db = new Database('taskmanager.db');

// Transactions for atomic operations
const insertQueue = db.prepare('INSERT INTO queues ...');
const insertTask = db.prepare('INSERT INTO tasks ...');

db.transaction(() => {
  insertQueue.run(queueData);
  insertTask.run(taskData);
})();
```

### Progress Tracking

Emit progress events from backend to frontend:
```javascript
// Backend (main process)
mainWindow.webContents.send('task-progress', {
  taskId: 'task-123',
  progress: 45,
  status: 'running'
});

// Frontend (renderer)
window.api.on('task-progress', (data) => {
  // Update UI
});
```

---

## Future Enhancements

- **Task Templates**: Save common task configurations as reusable templates
- **Notifications**: Desktop notifications for completed tasks/workflows
- **Scheduling**: Schedule queues to run at specific times
- **Remote Execution**: Execute tasks on remote machines via SSH
- **Logs**: Detailed execution logs with search and filtering
- **Statistics**: Track execution times, success rates, etc.
- **Plugins**: Support for custom task types via plugin system
- **Cloud Sync**: Sync workflows and configurations across devices

---

## Development Roadmap

### Phase 1: Core Foundation
- [x] Setup Electron project structure
- [x] Implement SQLite database layer
- [x] Create basic UI layout with React
- [x] Implement Queue functionality
- [x] Add basic task types (copy, move, delete)
- [x] Add file and folder picker

### Phase 2: Workflow System
- [x] Implement Workflow data model
- [x] Add manual file selection
- [x] Create workflow task pipeline editor
- [x] Implement sequential execution
- [x] Add parallel execution mode

### Phase 3: Directory Watching
- [x] Integrate chokidar for file watching
- [x] Implement file stability detection
- [x] Add filter configuration UI
- [x] Implement processed file tracking

### Phase 4: Advanced Tasks
- [x] Add rsync support
- [x] Add ffmpeg transcode support
- [x] Add archive creation/extraction
- [x] Add permission changes
- [x] Add FTP/SFTP support

### Phase 5: Polish
- [ ] Improve error handling and user feedback
- [ ] Add comprehensive logging
- [ ] Create settings/preferences panel
- [ ] Add keyboard shortcuts
- [ ] Write user documentation

---

## Summary

This application provides a flexible, powerful system for automating repetitive file operations through three complementary approaches:

- **Queues**: One-time manual task execution
- **Workflows**: Persistent pipelines for processing multiple files
- **Watchers**: Automated file detection and processing

Built on Electron/Node.js for cross-platform compatibility and ease of development, with a clean separation between the UI (React) and backend (Node.js) processes.
