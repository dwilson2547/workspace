import type { Queue, TaskHistoryEntry, TaskType } from '@shared/types';
import FilePicker from './FilePicker';
import { formatDuration, formatTimestamp, getBaseName } from '../utils/formatters';

interface QueueViewProps {
  queue: Queue;
  isCreatingTask: boolean;
  taskType: TaskType;
  sourcePath: string;
  destinationDirectory: string;
  destinationName: string;
  taskLabels: Record<TaskType, string>;
  onToggleCreateTask: () => void;
  onTaskTypeChange: (value: TaskType) => void;
  onSourcePathChange: (value: string) => void;
  onDestinationDirectoryChange: (value: string) => void;
  onDestinationNameChange: (value: string) => void;
  onAddTask: () => void;
  onRunQueue: () => void;
  onPauseQueue: () => void;
  onRemoveTask: (taskId: string) => void;
  onRemoveHistoryItem: (historyId: string) => void;
  onCancelCreateTask: () => void;
}

export default function QueueView({
  queue,
  isCreatingTask,
  taskType,
  sourcePath,
  destinationDirectory,
  destinationName,
  taskLabels,
  onToggleCreateTask,
  onTaskTypeChange,
  onSourcePathChange,
  onDestinationDirectoryChange,
  onDestinationNameChange,
  onAddTask,
  onRunQueue,
  onPauseQueue,
  onRemoveTask,
  onRemoveHistoryItem,
  onCancelCreateTask
}: QueueViewProps) {
  return (
    <section>
      <header className="queue-header">
        <div>
          <h2>{queue.name}</h2>
          <p className="muted">Status: {queue.status}</p>
        </div>
        <div className="actions">
          <button onClick={onRunQueue}>Start</button>
          <button onClick={onPauseQueue}>Pause</button>
          <button onClick={onToggleCreateTask}>Add Task</button>
        </div>
      </header>

      {isCreatingTask && (
        <div className="panel">
          <div className="field-row">
            <label>
              Task type
              <select value={taskType} onChange={(event) => onTaskTypeChange(event.target.value as TaskType)}>
                <option value="copy">Copy</option>
                <option value="move">Move</option>
                <option value="delete">Delete</option>
              </select>
            </label>
            <FilePicker
              label="Source path"
              value={sourcePath}
              onChange={(value) => onSourcePathChange(value)}
              placeholder="/path/to/source"
              mode="fileOrDirectory"
            />
            {taskType !== 'delete' && (
              <div className="destination-group">
                <FilePicker
                  label="Destination directory"
                  value={destinationDirectory}
                  onChange={onDestinationDirectoryChange}
                  placeholder="/path/to/destination"
                  mode="directory"
                />
                <label className="destination-name">
                  Destination name
                  <input
                    value={destinationName}
                    onChange={(event) => onDestinationNameChange(event.target.value)}
                    placeholder={getBaseName(sourcePath) || 'filename.ext'}
                  />
                </label>
              </div>
            )}
          </div>
          <div className="actions">
            <button onClick={onAddTask}>Save task</button>
            <button className="secondary" onClick={onCancelCreateTask}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="task-list">
        {queue.tasks.length === 0 ? (
          <p className="muted">No tasks in this queue yet.</p>
        ) : (
          queue.tasks.map((task) => (
            <div key={task.id} className="task-card">
              <div>
                <h3>{task.name}</h3>
                <p className="muted">Type: {taskLabels[task.type]}</p>
                <p className="muted">Status: {task.status}</p>
                {task.status === 'pending' && (
                  <button className="secondary" onClick={() => onRemoveTask(task.id)}>
                    Remove
                  </button>
                )}
              </div>
              <div>
                {task.config?.sourcePath && <p className="path">{task.config.sourcePath}</p>}
                {task.config?.destinationPath && <p className="path">→ {task.config.destinationPath}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      <section className="history">
        <h3>History</h3>
        {queue.history.length === 0 ? (
          <p className="muted">No completed tasks yet.</p>
        ) : (
          <div className="history-list">
            {queue.history.map((entry: TaskHistoryEntry) => (
              <div key={entry.id} className="history-card">
                <div>
                  <h4>{entry.task.name}</h4>
                  <p className="muted">Type: {taskLabels[entry.task.type]}</p>
                  <p className="muted">Status: {entry.task.status}</p>
                  <button className="secondary" onClick={() => onRemoveHistoryItem(entry.id)}>
                    Remove
                  </button>
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
  );
}
