import { useEffect, useMemo, useState } from 'react';
import type {
  ElectronAPI,
  DirectoryWatcherConfig,
  Queue,
  TaskHistoryEntry,
  TaskType,
  Workflow,
  WorkflowFile,
  WorkflowTask
} from '@shared/types';
import FilePicker from './components/FilePicker';

declare global {
  interface Window {
    api: ElectronAPI;
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

const defaultWatcherConfig: DirectoryWatcherConfig = {
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

const parseExtensions = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (item.startsWith('.') ? item : `.${item}`));

export default function App() {
  const api = window.api;
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isCreatingQueue, setIsCreatingQueue] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('copy');
  const [sourcePath, setSourcePath] = useState('');
  const [destinationDirectory, setDestinationDirectory] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [isCreatingWorkflowTask, setIsCreatingWorkflowTask] = useState(false);
  const [workflowTaskType, setWorkflowTaskType] = useState<TaskType>('copy');
  const [workflowDestinationDirectory, setWorkflowDestinationDirectory] = useState('');
  const [watcherConfig, setWatcherConfig] = useState<DirectoryWatcherConfig>(defaultWatcherConfig);
  const selectedQueue = useMemo(
    () => queues.find((queue) => queue.id === selectedQueueId) ?? null,
    [queues, selectedQueueId]
  );
  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [workflows, selectedWorkflowId]
  );

  const refreshQueues = async () => {
    if (!api) {
      return;
    }
    const data = await api.listQueues();
    setQueues(data);
    if (!selectedQueueId && !selectedWorkflowId && data.length > 0) {
      setSelectedQueueId(data[0].id);
    }
  };

  const refreshWorkflows = async () => {
    if (!api) {
      return;
    }
    const data = await api.listWorkflows();
    setWorkflows(data);
    if (!selectedWorkflowId && !selectedQueueId && data.length > 0) {
      setSelectedWorkflowId(data[0].id);
    }
  };

  useEffect(() => {
    refreshQueues();
    refreshWorkflows();
    const interval = setInterval(() => {
      refreshQueues();
      refreshWorkflows();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedWorkflow?.watcherConfig) {
      setWatcherConfig({
        ...defaultWatcherConfig,
        ...selectedWorkflow.watcherConfig,
        filters: {
          ...defaultWatcherConfig.filters,
          ...(selectedWorkflow.watcherConfig.filters ?? {})
        }
      });
    } else {
      setWatcherConfig(defaultWatcherConfig);
    }
  }, [selectedWorkflow]);

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

  const handleCreateWorkflow = async () => {
    if (!api) {
      return;
    }
    if (!workflowName.trim()) {
      return;
    }
    const workflow = await api.createWorkflow(workflowName.trim());
    setWorkflows((prev) => [...prev, workflow]);
    setSelectedWorkflowId(workflow.id);
    setWorkflowName('');
    setIsCreatingWorkflow(false);
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

  const handleAddWorkflowTask = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    if (workflowTaskType !== 'delete' && !workflowDestinationDirectory.trim()) {
      return;
    }
    await api.addWorkflowTask(selectedWorkflow.id, {
      name: `${taskLabels[workflowTaskType]} Step`,
      type: workflowTaskType,
      config: {
        destinationDirectory:
          workflowTaskType === 'delete' ? undefined : workflowDestinationDirectory.trim()
      }
    });

    setWorkflowTaskType('copy');
    setWorkflowDestinationDirectory('');
    setIsCreatingWorkflowTask(false);
    refreshWorkflows();
  };

  const handleRemoveWorkflowTask = async (taskId: string) => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.removeWorkflowTask(selectedWorkflow.id, taskId);
    refreshWorkflows();
  };

  const handleAddWorkflowFiles = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    const files = await api.pickPath({ mode: 'file', allowMultiple: true });
    if (files.length === 0) {
      return;
    }
    await api.addWorkflowFiles(selectedWorkflow.id, files);
    refreshWorkflows();
  };

  const handleAddWorkflowFolder = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    const selection = await api.pickPath({ mode: 'directory', allowMultiple: false });
    if (selection.length === 0) {
      return;
    }
    await api.addWorkflowFolder(selectedWorkflow.id, selection[0]);
    refreshWorkflows();
  };

  const handleRunWorkflow = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.runWorkflow(selectedWorkflow.id);
    refreshWorkflows();
  };

  const handlePauseWorkflow = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.pauseWorkflow(selectedWorkflow.id);
    refreshWorkflows();
  };

  const handleUpdateWorkflowSettings = async (
    updates: Pick<Workflow, 'executionMode' | 'maxParallel'>
  ) => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.updateWorkflowSettings(selectedWorkflow.id, updates);
    refreshWorkflows();
  };

  const handleSaveWatcherConfig = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.updateWorkflowWatcherConfig(selectedWorkflow.id, watcherConfig);
    refreshWorkflows();
  };

  const handleStartWatcher = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    const nextConfig = { ...watcherConfig, enabled: true };
    setWatcherConfig(nextConfig);
    await api.updateWorkflowWatcherConfig(selectedWorkflow.id, nextConfig);
    await api.startWorkflowWatcher(selectedWorkflow.id);
  };

  const handleStopWatcher = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    const nextConfig = { ...watcherConfig, enabled: false };
    setWatcherConfig(nextConfig);
    await api.updateWorkflowWatcherConfig(selectedWorkflow.id, nextConfig);
    await api.stopWorkflowWatcher(selectedWorkflow.id);
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
                onClick={() => {
                  setSelectedQueueId(queue.id);
                  setSelectedWorkflowId(null);
                }}
              >
                <span>{queue.name}</span>
                <small>{queue.status}</small>
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-section">
          <div className="section-header">
            <h2>Workflows</h2>
            <button className="secondary" onClick={() => setIsCreatingWorkflow((prev) => !prev)}>
              + New
            </button>
          </div>
          {isCreatingWorkflow && (
            <div className="panel">
              <label>
                Workflow name
                <input
                  value={workflowName}
                  onChange={(event) => setWorkflowName(event.target.value)}
                  placeholder="e.g. Video pipeline"
                />
              </label>
              <div className="actions">
                <button onClick={handleCreateWorkflow}>Create</button>
                <button className="secondary" onClick={() => setIsCreatingWorkflow(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          <ul>
            {workflows.map((workflow) => (
              <li
                key={workflow.id}
                className={workflow.id === selectedWorkflowId ? 'active' : ''}
                onClick={() => {
                  setSelectedWorkflowId(workflow.id);
                  setSelectedQueueId(null);
                }}
              >
                <span>{workflow.name}</span>
                <small>{workflow.status}</small>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="content">
        {selectedWorkflow ? (
          <section>
            <header className="queue-header">
              <div>
                <h2>{selectedWorkflow.name}</h2>
                <p className="muted">Status: {selectedWorkflow.status}</p>
              </div>
              <div className="actions">
                <button onClick={handleRunWorkflow}>Start</button>
                <button onClick={handlePauseWorkflow}>Pause</button>
                <button onClick={() => setIsCreatingWorkflowTask((prev) => !prev)}>Add Task</button>
                <button className="secondary" onClick={handleAddWorkflowFiles}>
                  Add Files
                </button>
                <button className="secondary" onClick={handleAddWorkflowFolder}>
                  Add Folder
                </button>
              </div>
            </header>

            <div className="panel workflow-settings">
              <label>
                Execution mode
                <select
                  value={selectedWorkflow.executionMode}
                  onChange={(event) =>
                    handleUpdateWorkflowSettings({
                      executionMode: event.target.value as Workflow['executionMode'],
                      maxParallel: selectedWorkflow.maxParallel
                    })
                  }
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                </select>
              </label>
              {selectedWorkflow.executionMode === 'parallel' && (
                <label>
                  Max parallel
                  <input
                    type="number"
                    min={1}
                    value={selectedWorkflow.maxParallel ?? 2}
                    onChange={(event) =>
                      handleUpdateWorkflowSettings({
                        executionMode: selectedWorkflow.executionMode,
                        maxParallel: Math.max(1, Number(event.target.value) || 1)
                      })
                    }
                  />
                </label>
              )}
            </div>

            {isCreatingWorkflowTask && (
              <div className="panel">
                <div className="field-row">
                  <label>
                    Task type
                    <select
                      value={workflowTaskType}
                      onChange={(event) => setWorkflowTaskType(event.target.value as TaskType)}
                    >
                      <option value="copy">Copy</option>
                      <option value="move">Move</option>
                      <option value="delete">Delete</option>
                    </select>
                  </label>
                  {workflowTaskType !== 'delete' && (
                    <FilePicker
                      label="Destination directory"
                      value={workflowDestinationDirectory}
                      onChange={setWorkflowDestinationDirectory}
                      placeholder="/path/to/destination"
                      mode="directory"
                    />
                  )}
                </div>
                <div className="actions">
                  <button onClick={handleAddWorkflowTask}>Save task</button>
                  <button className="secondary" onClick={() => setIsCreatingWorkflowTask(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <section className="task-list">
              <h3>Task Pipeline</h3>
              {selectedWorkflow.tasks.length === 0 ? (
                <p className="muted">No workflow tasks yet.</p>
              ) : (
                selectedWorkflow.tasks.map((task: WorkflowTask) => (
                  <div key={task.id} className="task-card">
                    <div>
                      <h3>{task.name}</h3>
                      <p className="muted">Type: {taskLabels[task.type]}</p>
                      <p className="muted">Order: {task.order + 1}</p>
                      <button className="secondary" onClick={() => handleRemoveWorkflowTask(task.id)}>
                        Remove
                      </button>
                    </div>
                    <div>
                      {task.config?.destinationDirectory && (
                        <p className="path">→ {task.config.destinationDirectory}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="history">
              <h3>File Queue</h3>
              {selectedWorkflow.fileQueue.length === 0 ? (
                <p className="muted">No files queued yet.</p>
              ) : (
                <div className="history-list">
                  {selectedWorkflow.fileQueue.map((file: WorkflowFile) => (
                    <div key={file.id} className="history-card">
                      <div>
                        <h4>{getBaseName(file.filePath)}</h4>
                        <p className="muted">Status: {file.status}</p>
                        <p className="muted">
                          Task: {file.currentTaskIndex}/{selectedWorkflow.tasks.length}
                        </p>
                      </div>
                      <div>
                        <p className="path">{file.filePath}</p>
                        {file.error && <p className="error">{file.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="history">
              <h3>Directory Watcher</h3>
              <div className="panel watcher-panel">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={watcherConfig.enabled}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({ ...prev, enabled: event.target.checked }))
                    }
                  />
                  Enabled
                </label>
                <FilePicker
                  label="Watch path"
                  value={watcherConfig.watchPath}
                  onChange={(value) => setWatcherConfig((prev) => ({ ...prev, watchPath: value }))}
                  placeholder="/path/to/watch"
                  mode="directory"
                />
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={watcherConfig.recursive}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({ ...prev, recursive: event.target.checked }))
                    }
                  />
                  Recursive
                </label>
                <label>
                  Extensions (comma-separated)
                  <input
                    value={(watcherConfig.filters.extensions ?? []).join(', ')}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({
                        ...prev,
                        filters: { ...prev.filters, extensions: parseExtensions(event.target.value) }
                      }))
                    }
                    placeholder=".mp4, .mkv"
                  />
                </label>
                <label>
                  Filename pattern (glob or /regex/)
                  <input
                    value={watcherConfig.filters.filenamePattern ?? ''}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({
                        ...prev,
                        filters: { ...prev.filters, filenamePattern: event.target.value }
                      }))
                    }
                    placeholder="*.mp4"
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={watcherConfig.filters.ignoreHidden ?? false}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({
                        ...prev,
                        filters: { ...prev.filters, ignoreHidden: event.target.checked }
                      }))
                    }
                  />
                  Ignore hidden files
                </label>
                <label>
                  Minimum size (bytes)
                  <input
                    type="number"
                    min={0}
                    value={watcherConfig.filters.minSize ?? ''}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({
                        ...prev,
                        filters: {
                          ...prev.filters,
                          minSize: event.target.value ? Number(event.target.value) : undefined
                        }
                      }))
                    }
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={watcherConfig.ignoreExisting}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({ ...prev, ignoreExisting: event.target.checked }))
                    }
                  />
                  Ignore existing files
                </label>
                <label>
                  Stability delay (ms)
                  <input
                    type="number"
                    min={500}
                    value={watcherConfig.stabilityDelay}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({
                        ...prev,
                        stabilityDelay: Math.max(500, Number(event.target.value) || 500)
                      }))
                    }
                  />
                </label>
                <label>
                  Poll interval (ms)
                  <input
                    type="number"
                    min={200}
                    value={watcherConfig.pollInterval ?? ''}
                    onChange={(event) =>
                      setWatcherConfig((prev) => ({
                        ...prev,
                        pollInterval: event.target.value ? Number(event.target.value) : undefined
                      }))
                    }
                    placeholder="Leave blank for native"
                  />
                </label>
                <div className="actions">
                  <button onClick={handleSaveWatcherConfig}>Save Settings</button>
                  <button className="secondary" onClick={handleStartWatcher}>
                    Start Watcher
                  </button>
                  <button className="secondary" onClick={handleStopWatcher}>
                    Stop Watcher
                  </button>
                </div>
              </div>
            </section>
          </section>
        ) : selectedQueue ? (
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
            <h2>Select a queue or workflow</h2>
            <p className="muted">Create a queue or workflow to get started.</p>
          </section>
        )}
      </main>
    </div>
  );
}
