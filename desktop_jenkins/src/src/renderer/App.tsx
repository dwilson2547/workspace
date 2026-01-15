import { useEffect, useMemo, useState } from 'react';
import type { FilePickerOptions, Queue, Task, TaskType } from '@shared/types';
import FilePicker from './components/FilePicker';

declare global {
  interface Window {
    api: {
      listQueues: () => Promise<Queue[]>;
      createQueue: (name: string) => Promise<Queue>;
      addTask: (queueId: string, task: Omit<Task, 'id' | 'status' | 'createdAt'>) => Promise<Task>;
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

export default function App() {
  const api = window.api;
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isCreatingQueue, setIsCreatingQueue] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('copy');
  const [sourcePath, setSourcePath] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
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
    if (taskType !== 'delete' && !destinationPath.trim()) {
      return;
    }

    await api.addTask(selectedQueue.id, {
      name: `${taskLabels[taskType]} Task`,
      type: taskType,
      config: {
        sourcePath: sourcePath.trim(),
        destinationPath: taskType === 'delete' ? undefined : destinationPath.trim()
      }
    });

    setSourcePath('');
    setDestinationPath('');
    setTaskType('copy');
    setIsCreatingTask(false);
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
                    onChange={setSourcePath}
                    placeholder="/path/to/source"
                    mode="fileOrDirectory"
                  />
                  {taskType !== 'delete' && (
                    <FilePicker
                      label="Destination path"
                      value={destinationPath}
                      onChange={setDestinationPath}
                      placeholder="/path/to/destination"
                      mode="fileOrDirectory"
                    />
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
