import type {
  DirectoryWatcherConfig,
  TaskType,
  Workflow,
  WorkflowFile,
  WorkflowFileHistory,
  WorkflowTask
} from '@shared/types';
import FilePicker from './FilePicker';
import { formatTimestamp, getBaseName, parseExtensions } from '../utils/formatters';

interface WorkflowViewProps {
  workflow: Workflow;
  isCreatingWorkflowTask: boolean;
  workflowTaskType: TaskType;
  workflowDestinationDirectory: string;
  taskLabels: Record<TaskType, string>;
  watcherConfig: DirectoryWatcherConfig;
  onToggleCreateWorkflowTask: () => void;
  onWorkflowTaskTypeChange: (value: TaskType) => void;
  onWorkflowDestinationDirectoryChange: (value: string) => void;
  onAddWorkflowTask: () => void;
  onRemoveWorkflowTask: (taskId: string) => void;
  onAddWorkflowFiles: () => void;
  onAddWorkflowFolder: () => void;
  onRunWorkflow: () => void;
  onPauseWorkflow: () => void;
  onUpdateWorkflowSettings: (settings: Pick<Workflow, 'executionMode' | 'maxParallel'>) => void;
  onRemoveWorkflowFile: (fileId: string) => void;
  onRemoveWorkflowHistoryItem: (historyId: string) => void;
  onClearWorkflowHistory: () => void;
  onExportWorkflowHistory: () => void;
  onSaveWatcherConfig: () => void;
  onStartWatcher: () => void;
  onStopWatcher: () => void;
  onWatcherConfigChange: (config: DirectoryWatcherConfig) => void;
}

export default function WorkflowView({
  workflow,
  isCreatingWorkflowTask,
  workflowTaskType,
  workflowDestinationDirectory,
  taskLabels,
  watcherConfig,
  onToggleCreateWorkflowTask,
  onWorkflowTaskTypeChange,
  onWorkflowDestinationDirectoryChange,
  onAddWorkflowTask,
  onRemoveWorkflowTask,
  onAddWorkflowFiles,
  onAddWorkflowFolder,
  onRunWorkflow,
  onPauseWorkflow,
  onUpdateWorkflowSettings,
  onRemoveWorkflowFile,
  onRemoveWorkflowHistoryItem,
  onClearWorkflowHistory,
  onExportWorkflowHistory,
  onSaveWatcherConfig,
  onStartWatcher,
  onStopWatcher,
  onWatcherConfigChange
}: WorkflowViewProps) {
  return (
    <section>
      <header className="queue-header">
        <div>
          <h2>{workflow.name}</h2>
          <p className="muted">Status: {workflow.status}</p>
        </div>
        <div className="actions">
          <button onClick={onRunWorkflow}>Start</button>
          <button onClick={onPauseWorkflow}>Pause</button>
          <button onClick={onToggleCreateWorkflowTask}>Add Task</button>
          <button className="secondary" onClick={onAddWorkflowFiles}>
            Add Files
          </button>
          <button className="secondary" onClick={onAddWorkflowFolder}>
            Add Folder
          </button>
        </div>
      </header>

      <div className="panel workflow-settings">
        <label>
          Execution mode
          <select
            value={workflow.executionMode}
            onChange={(event) =>
              onUpdateWorkflowSettings({
                executionMode: event.target.value as Workflow['executionMode'],
                maxParallel: workflow.maxParallel
              })
            }
          >
            <option value="sequential">Sequential</option>
            <option value="parallel">Parallel</option>
          </select>
        </label>
        {workflow.executionMode === 'parallel' && (
          <label>
            Max parallel
            <input
              type="number"
              min={1}
              value={workflow.maxParallel ?? 2}
              onChange={(event) =>
                onUpdateWorkflowSettings({
                  executionMode: workflow.executionMode,
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
                onChange={(event) => onWorkflowTaskTypeChange(event.target.value as TaskType)}
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
                onChange={onWorkflowDestinationDirectoryChange}
                placeholder="/path/to/destination"
                mode="directory"
              />
            )}
          </div>
          <div className="actions">
            <button onClick={onAddWorkflowTask}>Save task</button>
            <button className="secondary" onClick={onToggleCreateWorkflowTask}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="task-list">
        <h3>Task Pipeline</h3>
        {workflow.tasks.length === 0 ? (
          <p className="muted">No workflow tasks yet.</p>
        ) : (
          workflow.tasks.map((task: WorkflowTask) => (
            <div key={task.id} className="task-card">
              <div>
                <h3>{task.name}</h3>
                <p className="muted">Type: {taskLabels[task.type]}</p>
                <p className="muted">Order: {task.order + 1}</p>
                <button className="secondary" onClick={() => onRemoveWorkflowTask(task.id)}>
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
        {workflow.fileQueue.length === 0 ? (
          <p className="muted">No files queued yet.</p>
        ) : (
          <div className="history-list">
            {workflow.fileQueue.map((file: WorkflowFile) => (
              <div key={file.id} className="history-card">
                <div>
                  <h4>{getBaseName(file.filePath)}</h4>
                  <p className="muted">Status: {file.status}</p>
                  <p className="muted">
                    Task: {file.currentTaskIndex}/{workflow.tasks.length}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => onRemoveWorkflowFile(file.id)}
                    disabled={file.status === 'processing'}
                  >
                    Remove
                  </button>
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
        <div className="history-header">
          <h3>Workflow History</h3>
          <div className="actions">
            <button className="secondary" onClick={onExportWorkflowHistory}>
              Export JSON
            </button>
            <button className="secondary" onClick={onClearWorkflowHistory}>
              Clear All
            </button>
          </div>
        </div>
        {workflow.history.length === 0 ? (
          <p className="muted">No workflow history yet.</p>
        ) : (
          <div className="history-list">
            {workflow.history.map((entry: WorkflowFileHistory) => (
              <div key={entry.id} className="history-card">
                <div>
                  <h4>{getBaseName(entry.filePath)}</h4>
                  <p className="muted">Status: {entry.status}</p>
                  <p className="muted">Started: {formatTimestamp(entry.startedAt)}</p>
                  <p className="muted">Completed: {formatTimestamp(entry.completedAt)}</p>
                  <button className="secondary" onClick={() => onRemoveWorkflowHistoryItem(entry.id)}>
                    Remove
                  </button>
                </div>
                <div>
                  <p className="path">{entry.filePath}</p>
                  {entry.error && <p className="error">{entry.error}</p>}
                </div>
                <div>
                  <p className="muted">Task History:</p>
                  <ul className="task-history">
                    {entry.taskStatuses.map((task) => (
                      <li key={task.taskId}>
                        <span>
                          {task.order + 1}. {task.name}
                        </span>
                        <span className="muted">{task.status}</span>
                        {task.error && <span className="error">{task.error}</span>}
                      </li>
                    ))}
                  </ul>
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
                onWatcherConfigChange({
                  ...watcherConfig,
                  enabled: event.target.checked
                })
              }
            />
            Enabled
          </label>
          <FilePicker
            label="Watch path"
            value={watcherConfig.watchPath}
            onChange={(value) =>
              onWatcherConfigChange({
                ...watcherConfig,
                watchPath: value
              })
            }
            placeholder="/path/to/watch"
            mode="directory"
          />
          <label className="toggle">
            <input
              type="checkbox"
              checked={watcherConfig.recursive}
              onChange={(event) =>
                onWatcherConfigChange({
                  ...watcherConfig,
                  recursive: event.target.checked
                })
              }
            />
            Recursive
          </label>
          <label>
            Extensions (comma-separated)
            <input
              value={(watcherConfig.filters.extensions ?? []).join(', ')}
              onChange={(event) =>
                onWatcherConfigChange({
                  ...watcherConfig,
                  filters: {
                    ...watcherConfig.filters,
                    extensions: parseExtensions(event.target.value)
                  }
                })
              }
              placeholder=".mp4, .mkv"
            />
          </label>
          <label>
            Filename pattern (glob or /regex/)
            <input
              value={watcherConfig.filters.filenamePattern ?? ''}
              onChange={(event) =>
                onWatcherConfigChange({
                  ...watcherConfig,
                  filters: {
                    ...watcherConfig.filters,
                    filenamePattern: event.target.value
                  }
                })
              }
              placeholder="*.mp4"
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={watcherConfig.filters.ignoreHidden ?? false}
              onChange={(event) =>
                onWatcherConfigChange({
                  ...watcherConfig,
                  filters: {
                    ...watcherConfig.filters,
                    ignoreHidden: event.target.checked
                  }
                })
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
                onWatcherConfigChange({
                  ...watcherConfig,
                  filters: {
                    ...watcherConfig.filters,
                    minSize: event.target.value ? Number(event.target.value) : undefined
                  }
                })
              }
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={watcherConfig.ignoreExisting}
              onChange={(event) =>
                onWatcherConfigChange({
                  ...watcherConfig,
                  ignoreExisting: event.target.checked
                })
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
                onWatcherConfigChange({
                  ...watcherConfig,
                  stabilityDelay: Math.max(500, Number(event.target.value) || 500)
                })
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
                onWatcherConfigChange({
                  ...watcherConfig,
                  pollInterval: event.target.value ? Number(event.target.value) : undefined
                })
              }
              placeholder="Leave blank for native"
            />
          </label>
          <div className="actions">
            <button onClick={onSaveWatcherConfig}>Save Settings</button>
            <button className="secondary" onClick={onStartWatcher}>
              Start Watcher
            </button>
            <button className="secondary" onClick={onStopWatcher}>
              Stop Watcher
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
