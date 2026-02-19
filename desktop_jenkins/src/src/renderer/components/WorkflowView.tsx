import type {
  DirectoryWatcherConfig,
  TaskType,
  Workflow,
  WorkflowFile,
  WorkflowFileHistory,
  WorkflowTask
} from '@shared/types';
import FilePicker from './FilePicker';
import { ffmpegCodecOptions, formatTimestamp, getBaseName, parseExtensions } from '../utils/formatters';

interface WorkflowViewProps {
  workflow: Workflow;
  isCreatingWorkflowTask: boolean;
  workflowTaskType: TaskType;
  workflowDestinationDirectory: string;
  workflowDestinationName: string;
  workflowRsyncArgs: string;
  workflowFfmpegArgs: string;
  workflowFfmpegCodec: string;
  workflowFfmpegCq: string;
  workflowOutputExtension: string;
  workflowArchiveFormat: 'zip' | 'tar' | 'tar.gz';
  workflowChmodMode: string;
  workflowChmodRecursive: boolean;
  workflowChownUser: string;
  workflowChownGroup: string;
  workflowChownRecursive: boolean;
  workflowFtpHost: string;
  workflowFtpPort: string;
  workflowFtpUsername: string;
  workflowFtpPassword: string;
  workflowFtpRemotePath: string;
  workflowFtpSecure: boolean;
  workflowSftpHost: string;
  workflowSftpPort: string;
  workflowSftpUsername: string;
  workflowSftpPassword: string;
  workflowSftpRemotePath: string;
  taskLabels: Record<TaskType, string>;
  watcherConfig: DirectoryWatcherConfig;
  onToggleCreateWorkflowTask: () => void;
  onWorkflowTaskTypeChange: (value: TaskType) => void;
  onWorkflowDestinationDirectoryChange: (value: string) => void;
  onWorkflowDestinationNameChange: (value: string) => void;
  onWorkflowRsyncArgsChange: (value: string) => void;
  onWorkflowFfmpegArgsChange: (value: string) => void;
  onWorkflowFfmpegCodecChange: (value: string) => void;
  onWorkflowFfmpegCqChange: (value: string) => void;
  onWorkflowOutputExtensionChange: (value: string) => void;
  onWorkflowArchiveFormatChange: (value: 'zip' | 'tar' | 'tar.gz') => void;
  onWorkflowChmodModeChange: (value: string) => void;
  onWorkflowChmodRecursiveChange: (value: boolean) => void;
  onWorkflowChownUserChange: (value: string) => void;
  onWorkflowChownGroupChange: (value: string) => void;
  onWorkflowChownRecursiveChange: (value: boolean) => void;
  onWorkflowFtpHostChange: (value: string) => void;
  onWorkflowFtpPortChange: (value: string) => void;
  onWorkflowFtpUsernameChange: (value: string) => void;
  onWorkflowFtpPasswordChange: (value: string) => void;
  onWorkflowFtpRemotePathChange: (value: string) => void;
  onWorkflowFtpSecureChange: (value: boolean) => void;
  onWorkflowSftpHostChange: (value: string) => void;
  onWorkflowSftpPortChange: (value: string) => void;
  onWorkflowSftpUsernameChange: (value: string) => void;
  onWorkflowSftpPasswordChange: (value: string) => void;
  onWorkflowSftpRemotePathChange: (value: string) => void;
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
  workflowDestinationName,
  workflowRsyncArgs,
  workflowFfmpegArgs,
  workflowFfmpegCodec,
  workflowFfmpegCq,
  workflowOutputExtension,
  workflowArchiveFormat,
  workflowChmodMode,
  workflowChmodRecursive,
  workflowChownUser,
  workflowChownGroup,
  workflowChownRecursive,
  workflowFtpHost,
  workflowFtpPort,
  workflowFtpUsername,
  workflowFtpPassword,
  workflowFtpRemotePath,
  workflowFtpSecure,
  workflowSftpHost,
  workflowSftpPort,
  workflowSftpUsername,
  workflowSftpPassword,
  workflowSftpRemotePath,
  taskLabels,
  watcherConfig,
  onToggleCreateWorkflowTask,
  onWorkflowTaskTypeChange,
  onWorkflowDestinationDirectoryChange,
  onWorkflowDestinationNameChange,
  onWorkflowRsyncArgsChange,
  onWorkflowFfmpegArgsChange,
  onWorkflowFfmpegCodecChange,
  onWorkflowFfmpegCqChange,
  onWorkflowOutputExtensionChange,
  onWorkflowArchiveFormatChange,
  onWorkflowChmodModeChange,
  onWorkflowChmodRecursiveChange,
  onWorkflowChownUserChange,
  onWorkflowChownGroupChange,
  onWorkflowChownRecursiveChange,
  onWorkflowFtpHostChange,
  onWorkflowFtpPortChange,
  onWorkflowFtpUsernameChange,
  onWorkflowFtpPasswordChange,
  onWorkflowFtpRemotePathChange,
  onWorkflowFtpSecureChange,
  onWorkflowSftpHostChange,
  onWorkflowSftpPortChange,
  onWorkflowSftpUsernameChange,
  onWorkflowSftpPasswordChange,
  onWorkflowSftpRemotePathChange,
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
  const showWorkflowDestinationDirectory =
    workflowTaskType === 'copy' ||
    workflowTaskType === 'move' ||
    workflowTaskType === 'rsync' ||
    workflowTaskType === 'ffmpeg' ||
    workflowTaskType === 'archiveCreate' ||
    workflowTaskType === 'archiveExtract';

  const showWorkflowDestinationName =
    workflowTaskType === 'copy' ||
    workflowTaskType === 'move' ||
    workflowTaskType === 'rsync' ||
    workflowTaskType === 'ffmpeg' ||
    workflowTaskType === 'archiveCreate';

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
                <option value="rsync">Rsync</option>
                <option value="ffmpeg">FFmpeg Transcode</option>
                <option value="archiveCreate">Create Archive</option>
                <option value="archiveExtract">Extract Archive</option>
                <option value="chmod">Change Permissions (chmod)</option>
                <option value="chown">Change Ownership (chown)</option>
                <option value="ftp">FTP Upload</option>
                <option value="sftp">SFTP Upload</option>
              </select>
            </label>
            {showWorkflowDestinationDirectory && (
              <FilePicker
                label={workflowTaskType === 'archiveExtract' ? 'Extract to' : 'Destination directory'}
                value={workflowDestinationDirectory}
                onChange={onWorkflowDestinationDirectoryChange}
                placeholder="/path/to/destination"
                mode="directory"
              />
            )}
            {showWorkflowDestinationName && (
              <label>
                Destination name
                <input
                  value={workflowDestinationName}
                  onChange={(event) => onWorkflowDestinationNameChange(event.target.value)}
                  placeholder="filename.ext"
                />
              </label>
            )}
            {workflowTaskType === 'rsync' && (
              <label>
                Rsync arguments
                <input
                  value={workflowRsyncArgs}
                  onChange={(event) => onWorkflowRsyncArgsChange(event.target.value)}
                  placeholder="-av --delete"
                />
              </label>
            )}
            {workflowTaskType === 'ffmpeg' && (
              <>
                <label>
                  Video codec
                  <select
                    value={workflowFfmpegCodec}
                    onChange={(event) => onWorkflowFfmpegCodecChange(event.target.value)}
                  >
                    {ffmpegCodecOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  CQ (Constant Quality)
                  <input
                    type="number"
                    min={0}
                    value={workflowFfmpegCq}
                    onChange={(event) => onWorkflowFfmpegCqChange(event.target.value)}
                    placeholder="23"
                  />
                </label>
                <label>
                  FFmpeg arguments
                  <input
                    value={workflowFfmpegArgs}
                    onChange={(event) => onWorkflowFfmpegArgsChange(event.target.value)}
                    placeholder="-c:v libx265 -crf 23"
                  />
                </label>
                <label>
                  Output extension
                  <input
                    value={workflowOutputExtension}
                    onChange={(event) => onWorkflowOutputExtensionChange(event.target.value)}
                    placeholder=".mp4"
                  />
                </label>
              </>
            )}
            {(workflowTaskType === 'archiveCreate' || workflowTaskType === 'archiveExtract') && (
              <label>
                Archive format
                <select
                  value={workflowArchiveFormat}
                  onChange={(event) =>
                    onWorkflowArchiveFormatChange(event.target.value as 'zip' | 'tar' | 'tar.gz')
                  }
                >
                  <option value="zip">zip</option>
                  <option value="tar">tar</option>
                  <option value="tar.gz">tar.gz</option>
                </select>
              </label>
            )}
            {workflowTaskType === 'chmod' && (
              <>
                <label>
                  Mode (octal)
                  <input
                    value={workflowChmodMode}
                    onChange={(event) => onWorkflowChmodModeChange(event.target.value)}
                    placeholder="644"
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={workflowChmodRecursive}
                    onChange={(event) => onWorkflowChmodRecursiveChange(event.target.checked)}
                  />
                  Recursive
                </label>
              </>
            )}
            {workflowTaskType === 'chown' && (
              <>
                <label>
                  User ID
                  <input
                    value={workflowChownUser}
                    onChange={(event) => onWorkflowChownUserChange(event.target.value)}
                    placeholder="1000"
                  />
                </label>
                <label>
                  Group ID
                  <input
                    value={workflowChownGroup}
                    onChange={(event) => onWorkflowChownGroupChange(event.target.value)}
                    placeholder="1000"
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={workflowChownRecursive}
                    onChange={(event) => onWorkflowChownRecursiveChange(event.target.checked)}
                  />
                  Recursive
                </label>
              </>
            )}
            {workflowTaskType === 'ftp' && (
              <>
                <label>
                  Host
                  <input
                    value={workflowFtpHost}
                    onChange={(event) => onWorkflowFtpHostChange(event.target.value)}
                    placeholder="ftp.example.com"
                  />
                </label>
                <label>
                  Port
                  <input
                    value={workflowFtpPort}
                    onChange={(event) => onWorkflowFtpPortChange(event.target.value)}
                    placeholder="21"
                  />
                </label>
                <label>
                  Username
                  <input
                    value={workflowFtpUsername}
                    onChange={(event) => onWorkflowFtpUsernameChange(event.target.value)}
                    placeholder="user"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={workflowFtpPassword}
                    onChange={(event) => onWorkflowFtpPasswordChange(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <label>
                  Remote path
                  <input
                    value={workflowFtpRemotePath}
                    onChange={(event) => onWorkflowFtpRemotePathChange(event.target.value)}
                    placeholder="/remote/path"
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={workflowFtpSecure}
                    onChange={(event) => onWorkflowFtpSecureChange(event.target.checked)}
                  />
                  Secure (FTPS)
                </label>
              </>
            )}
            {workflowTaskType === 'sftp' && (
              <>
                <label>
                  Host
                  <input
                    value={workflowSftpHost}
                    onChange={(event) => onWorkflowSftpHostChange(event.target.value)}
                    placeholder="sftp.example.com"
                  />
                </label>
                <label>
                  Port
                  <input
                    value={workflowSftpPort}
                    onChange={(event) => onWorkflowSftpPortChange(event.target.value)}
                    placeholder="22"
                  />
                </label>
                <label>
                  Username
                  <input
                    value={workflowSftpUsername}
                    onChange={(event) => onWorkflowSftpUsernameChange(event.target.value)}
                    placeholder="user"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={workflowSftpPassword}
                    onChange={(event) => onWorkflowSftpPasswordChange(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <label>
                  Remote path
                  <input
                    value={workflowSftpRemotePath}
                    onChange={(event) => onWorkflowSftpRemotePathChange(event.target.value)}
                    placeholder="/remote/path"
                  />
                </label>
              </>
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
                {task.config?.destinationName && <p className="muted">Name: {task.config.destinationName}</p>}
                {task.config?.rsyncArgs && <p className="muted">Args: {task.config.rsyncArgs}</p>}
                {task.config?.ffmpegArgs && <p className="muted">Args: {task.config.ffmpegArgs}</p>}
                {task.config?.ffmpegCodec && <p className="muted">Codec: {task.config.ffmpegCodec}</p>}
                {typeof task.config?.ffmpegCq === 'number' && (
                  <p className="muted">CQ: {task.config.ffmpegCq}</p>
                )}
                {task.config?.outputExtension && (
                  <p className="muted">Output: {task.config.outputExtension}</p>
                )}
                {task.config?.archiveFormat && (
                  <p className="muted">Archive: {task.config.archiveFormat}</p>
                )}
                {task.config?.chmodMode && <p className="muted">Mode: {task.config.chmodMode}</p>}
                {(task.config?.chownUser || task.config?.chownGroup) && (
                  <p className="muted">
                    Owner: {task.config.chownUser ?? '—'}:{task.config.chownGroup ?? '—'}
                  </p>
                )}
                {task.config?.ftpRemotePath && <p className="muted">Remote: {task.config.ftpRemotePath}</p>}
                {task.config?.sftpRemotePath && <p className="muted">Remote: {task.config.sftpRemotePath}</p>}
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
