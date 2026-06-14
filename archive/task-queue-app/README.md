# Task Queue Manager

A desktop application for creating and managing file operation task queues. Built with Tauri (Rust backend) and React (frontend).

## Features

- **Multiple Task Queues**: Create and manage multiple independent task queues
- **Queue Control**: Pause and resume queues at will - pausing waits for the current task to complete
- **Task Types**:
  - **Copy**: Copy files or directories to a new location
  - **Zip**: Compress multiple files/directories into a ZIP archive
  - **Tar**: Create tar archives with optional gzip compression
  - **Transcode**: Convert video files using FFmpeg with full codec support
- **Progress Tracking**: Real-time progress updates for all task types
- **Task History**: View completed and failed tasks with statistics
- **Persistent Storage**: SQLite database stores all queues, tasks, and history

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Dashboard  │  │ Queue View  │  │ Task Forms  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ Tauri IPC
┌──────────────────────▼──────────────────────────────┐
│                   Rust Backend                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Command   │  │   Queue     │  │    Task     │  │
│  │  Handlers   │  │  Manager    │  │  Executors  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────────────────────────────────────────┐│
│  │              SQLite Database                    ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (18+)
- [FFmpeg](https://ffmpeg.org/) (for transcode tasks)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH.

## Development Setup

1. **Clone and install dependencies:**
```bash
git clone <repository>
cd task-queue-app
npm install
```

2. **Run in development mode:**
```bash
npm run tauri dev
```

3. **Build for production:**
```bash
npm run tauri build
```

## Project Structure

```
task-queue-app/
├── src/                    # Frontend source
│   ├── api.ts              # Tauri API wrapper
│   └── types.ts            # TypeScript type definitions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Application entry point
│   │   ├── commands.rs     # Tauri command handlers
│   │   ├── db/
│   │   │   ├── mod.rs      # Database operations
│   │   │   └── models.rs   # Data models
│   │   ├── queue/
│   │   │   └── mod.rs      # Queue manager
│   │   └── tasks/
│   │       ├── mod.rs      # Task executor trait
│   │       ├── copy.rs     # Copy executor
│   │       ├── zip.rs      # Zip executor
│   │       ├── tar.rs      # Tar executor
│   │       └── transcode.rs # FFmpeg transcode executor
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## API Reference

### Queue Operations

```typescript
// Create a new queue (paused by default)
const queue = await createQueue("My Queue");

// Get all queues
const queues = await getQueues();

// Resume/pause a queue
await resumeQueue(queueId);
await pauseQueue(queueId);  // Finishes current task first

// Delete a queue
await deleteQueue(queueId);
```

### Task Operations

```typescript
// Add a copy task
await addTask(queueId, 'copy', {
  source: '/path/to/source',
  destination: '/path/to/destination'
});

// Add a zip task
await addTask(queueId, 'zip', {
  inputs: ['/file1.txt', '/folder'],
  output: '/archive.zip'
});

// Add a tar task
await addTask(queueId, 'tar', {
  inputs: ['/file1.txt', '/folder'],
  output: '/archive.tar.gz',
  gzip: true
});

// Add a transcode task
await addTask(queueId, 'transcode', {
  input: '/video.mp4',
  output: '/video_converted.mp4',
  codec: 'libx264',
  preset: 'medium',
  crf: 23,
  resolution: '1920x1080',  // optional
  audio_codec: 'aac'        // optional
});
```

### Event Listeners

```typescript
// Listen for task progress
const unlisten = await onTaskProgress((progress) => {
  console.log(`Task ${progress.task_id}: ${progress.percentage}%`);
});

// Listen for task completion
await onTaskCompleted((completed) => {
  console.log(`Task ${completed.task_id}: ${completed.status}`);
});

// Listen for queue status changes
await onQueueStatusChanged((status) => {
  console.log(`Queue ${status.queue_id}: ${status.status}`);
});
```

## Database Schema

The application uses SQLite with three main tables:

### queues
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| name | TEXT | Queue name |
| status | TEXT | 'paused' or 'running' |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### tasks
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | UUID primary key |
| queue_id | TEXT | Foreign key to queues |
| task_type | TEXT | 'copy', 'zip', 'tar', 'transcode' |
| config | TEXT | JSON configuration |
| status | TEXT | 'pending', 'running', 'completed', 'failed' |
| position | INTEGER | Order in queue |
| created_at | TEXT | ISO timestamp |
| started_at | TEXT | ISO timestamp (nullable) |
| completed_at | TEXT | ISO timestamp (nullable) |
| error_message | TEXT | Error details (nullable) |

### task_history
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Auto-increment primary key |
| original_task_id | TEXT | Original task UUID |
| queue_id | TEXT | Queue UUID |
| queue_name | TEXT | Queue name at completion |
| task_type | TEXT | Task type |
| config | TEXT | JSON configuration |
| status | TEXT | Final status |
| started_at | TEXT | ISO timestamp |
| completed_at | TEXT | ISO timestamp |
| error_message | TEXT | Error details (nullable) |
| bytes_processed | INTEGER | Total bytes processed |
| duration_ms | INTEGER | Task duration in milliseconds |

## Extending with New Task Types

Adding a new task type is straightforward:

1. **Create the executor** in `src-tauri/src/tasks/`:

```rust
use async_trait::async_trait;
use super::{TaskExecutor, TaskError, TaskResult, ProgressSender};
use crate::db::models::TaskType;

pub struct MyNewExecutor;

#[async_trait]
impl TaskExecutor for MyNewExecutor {
    async fn execute(
        &self,
        task_id: &str,
        queue_id: &str,
        config: &serde_json::Value,
        progress_tx: ProgressSender,
    ) -> Result<TaskResult, TaskError> {
        // Your implementation here
    }

    fn task_type(&self) -> TaskType {
        TaskType::MyNew  // Add to TaskType enum
    }

    fn validate_config(&self, config: &serde_json::Value) -> Result<(), String> {
        // Validate configuration
    }
}
```

2. **Add to TaskType enum** in `src-tauri/src/db/models.rs`

3. **Register the executor** in `src-tauri/src/tasks/mod.rs`:

```rust
registry.insert("mynew".into(), Box::new(mynew::MyNewExecutor));
```

4. **Add frontend types** in `src/types.ts`

5. **Create the form component** in the React frontend

## Queue Behavior

- **New queues** start in a paused state
- **Adding tasks** to a paused queue appends them without starting the queue
- **Pausing a running queue** allows the current task to complete before stopping
- **Empty queues** auto-pause when they run out of tasks
- **Task order** can be rearranged while the queue is paused

## License

MIT
