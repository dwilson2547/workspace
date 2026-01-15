import { useEffect, useMemo, useState } from 'react';
import type { FilePickerOptions, Queue, Task, TaskHistoryEntry, TaskType } from '@shared/types';
import FilePicker from './components/FilePicker';

declare global {
  interface Window {
    api: {
      listQueues: () => Promise<Queue[]>;
      createQueue: (name: string) => Promise<Queue>;
      addTask: (queueId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>) => Promise<Task>;
      removeTask: (queueId: string, taskId: string) => Promise<boolean>;
      runQueue: (queueId: string) => Promise<void>;
      pauseQueue: (queueId: string) => Promise<void>;
      pickPath: (options: FilePickerOptions) => Promise<string[]>;
    };
  }
}

const taskLabels: Record<TaskType, string> = {
  copy: 'Copy',
  move: 'Move',
  delete: 'Delete'
};

const getBaseName = (value: string) => {
  const normalized = value.replace(/\\/g, '/');
  const trimmed = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  const segments = trimmed.split('/');
  return segments[segments.length - 1] || '';
};

const joinPath = (dir: string, name: string) => {
  if (!dir) {
    return name;
  }
  const separator = dir.includes('\\') ? '\\' : '/';
  const normalizedDir = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
  return `${normalizedDir}${separator}${name}`;
};

const formatDuration = (durationMs?: number) => {
  if (!durationMs || durationMs < 0) {
    return '—';
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const formatTimestamp = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

export default function App() {
  const api = window.api;
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isCreatingQueue, setIsCreatingQueue] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('copy');
  const [sourcePath, setSourcePath] = useState('');
  const [destinationDirectory, setDestinationDirectory] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const selectedQueue = useMemo(
    () => queues.find((queue) => queue.id === selectedQueueId) ?? null,
    [queues, selectedQueueId]
  );

  const refreshQueues = async () => {
    if (!api) {
      return;
    }
    const data = await api.listQueues();
    setQueues(data);
    if (!selectedQueueId && data.length > 0) {
      setSelectedQueueId(data[0].id);
    }
  };

  useEffect(() => {
    refreshQueues();
  }, []);

  const handleCreateQueue = async () => {
    if (!api) {
      return;
    }
    if (!queueName.trim()) {
      return;
    }
    const queue = await api.createQueue(queueName.trim());
    setQueues((prev) => [...prev, queue]);
    setSelectedQueueId(queue.id);
    setQueueName('');
    setIsCreatingQueue(false);
  };

  const handleAddTask = async () => {
    if (!api) {
      return;
    }
    if (!selectedQueue) {
      return;
    }
    if (!sourcePath.trim()) {
      return;
    }
    if (taskType !== 'delete' && (!destinationDirectory.trim() || !destinationName.trim())) {
      return;
    }

    const finalDestination =
      taskType === 'delete' ? undefined : joinPath(destinationDirectory.trim(), destinationName.trim());

    await api.addTask(selectedQueue.id, {
      name: `${taskLabels[taskType]} Task`,
      type: taskType,
      config: {
        sourcePath: sourcePath.trim(),
        destinationPath: finalDestination
      }
    });

    setSourcePath('');
    setDestinationDirectory('');
    setDestinationName('');
    setTaskType('copy');
    setIsCreatingTask(false);
    refreshQueues();
  };

  const handleRemoveTask = async (taskId: string) => {
    if (!api || !selectedQueue) {
      return;
    }
    await api.removeTask(selectedQueue.id, taskId);
    refreshQueues();
  };

  const handleRunQueue = async () => {
    if (!api) {
      return;
    }
    if (!selectedQueue) {
      return;
    }
    await api.runQueue(selectedQueue.id);
    refreshQueues();
  };

  const handlePauseQueue = async () => {
    if (!api) {
      return;
    }
    if (!selectedQueue) {
      return;
    }
    await api.pauseQueue(selectedQueue.id);
    refreshQueues();
  };

  if (!api) {
    return (
      <div className="app">
        <main className="content">
          <section className="panel">
            <h2>Electron preload not detected</h2>
            <p className="muted">
              The renderer is running without the preload bridge. Restart dev mode to rebuild the
              Electron main process and preload.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Task Manager</h1>
          <button onClick={() => setIsCreatingQueue((prev) => !prev)}>+ New Queue</button>
        </div>
        {isCreatingQueue && (
          <div className="panel">
            <label>
              Queue name
              <input
                value={queueName}
                onChange={(event) => setQueueName(event.target.value)}
                placeholder="e.g. Daily backups"
              />
            </label>
            <div className="actions">
              <button onClick={handleCreateQueue}>Create</button>
              <button className="secondary" onClick={() => setIsCreatingQueue(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="sidebar-section">
          <h2>Queues</h2>
          <ul>
            {queues.map((queue) => (
              <li
                key={queue.id}
                className={queue.id === selectedQueueId ? 'active' : ''}
                onClick={() => setSelectedQueueId(queue.id)}
              >
                <span>{queue.name}</span>
                <small>{queue.status}</small>
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-section">
          <h2>Workflows</h2>
          <p className="muted">Phase 1 placeholder</p>
        </div>
      </aside>

      <main className="content">
        {selectedQueue ? (
          <section>
            <header className="queue-header">
              <div>
                <h2>{selectedQueue.name}</h2>
                <p className="muted">Status: {selectedQueue.status}</p>
              </div>
              <div className="actions">
                <button onClick={handleRunQueue}>Start</button>
                <button onClick={handlePauseQueue}>Pause</button>
                <button onClick={() => setIsCreatingTask((prev) => !prev)}>Add Task</button>
              </div>
            </header>

            {isCreatingTask && (
              <div className="panel">
                <div className="field-row">
                  <label>
                    Task type
                    <select value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType)}>
                      <option value="copy">Copy</option>
                      <option value="move">Move</option>
                      <option value="delete">Delete</option>
                    </select>
                  </label>
                  <FilePicker
                    label="Source path"
                    value={sourcePath}
                    onChange={(value) => {
                      setSourcePath(value);
                      if (!destinationName) {
                        setDestinationName(getBaseName(value));
                      }
                    }}
                    placeholder="/path/to/source"
                    mode="fileOrDirectory"
                  />
                  {taskType !== 'delete' && (
                    <div className="destination-group">
                      <FilePicker
                        label="Destination directory"
                        value={destinationDirectory}
                        onChange={setDestinationDirectory}
                        placeholder="/path/to/destination"
                        mode="directory"
                      />
                      <label className="destination-name">
                        Destination name
                        <input
                          value={destinationName}
                          onChange={(event) => setDestinationName(event.target.value)}
                          placeholder={getBaseName(sourcePath) || 'filename.ext'}
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="actions">
                  <button onClick={handleAddTask}>Save task</button>
                  <button className="secondary" onClick={() => setIsCreatingTask(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="task-list">
              {selectedQueue.tasks.length === 0 ? (
                <p className="muted">No tasks in this queue yet.</p>
              ) : (
                selectedQueue.tasks.map((task) => (
                  <div key={task.id} className="task-card">
                    <div>
                      <h3>{task.name}</h3>
                      <p className="muted">Type: {taskLabels[task.type]}</p>
                      <p className="muted">Status: {task.status}</p>
                      {task.status === 'pending' && (
                        <button className="secondary" onClick={() => handleRemoveTask(task.id)}>
                          Remove
                        </button>
                      )}
                    </div>
                    <div>
                      {task.config?.sourcePath && (
                        <p className="path">{task.config.sourcePath}</p>
                      )}
                      {task.config?.destinationPath && (
                        <p className="path">→ {task.config.destinationPath}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <section className="history">
              <h3>History</h3>
              {selectedQueue.history.length === 0 ? (
                <p className="muted">No completed tasks yet.</p>
              ) : (
                <div className="history-list">
                  {selectedQueue.history.map((entry: TaskHistoryEntry) => (
                    <div key={entry.id} className="history-card">
                      <div>
                        <h4>{entry.task.name}</h4>
                        <p className="muted">Type: {taskLabels[entry.task.type]}</p>
                        <p className="muted">Status: {entry.task.status}</p>
                      </div>
                      <div>
                        <p className="muted">Started: {formatTimestamp(entry.task.startedAt)}</p>
                        <p className="muted">Completed: {formatTimestamp(entry.task.completedAt)}</p>
                        <p className="muted">Duration: {formatDuration(entry.durationMs)}</p>
                      </div>
                      <div>
                        {entry.task.config?.sourcePath && (
                          <p className="path">{entry.task.config.sourcePath}</p>
                        )}
                        {entry.task.config?.destinationPath && (
                          <p className="path">→ {entry.task.config.destinationPath}</p>
                        )}
                        {entry.task.error && <p className="error">{entry.task.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="empty-state">
            <h2>Select a queue</h2>
            <p className="muted">Create a queue to get started.</p>
          </section>
        )}
      </main>
    </div>
  );
}
