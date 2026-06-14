import type { Queue, TaskHistoryEntry, TaskType } from '@shared/types';
import FilePicker from './FilePicker';
import { ffmpegCodecOptions, formatDuration, formatTimestamp, getBaseName } from '../utils/formatters';

interface QueueViewProps {
  queue: Queue;
  isCreatingTask: boolean;
  taskType: TaskType;
  sourcePath: string;
  destinationDirectory: string;
  destinationName: string;
  rsyncArgs: string;
  ffmpegArgs: string;
  ffmpegCodec: string;
  ffmpegCq: string;
  ffmpegOutputExtension: string;
  archiveFormat: 'zip' | 'tar' | 'tar.gz';
  chmodMode: string;
  chmodRecursive: boolean;
  chownUser: string;
  chownGroup: string;
  chownRecursive: boolean;
  ftpHost: string;
  ftpPort: string;
  ftpUsername: string;
  ftpPassword: string;
  ftpRemotePath: string;
  ftpDirection: 'upload' | 'download';
  ftpSecure: boolean;
  sftpHost: string;
  sftpPort: string;
  sftpUsername: string;
  sftpPassword: string;
  sftpRemotePath: string;
  sftpDirection: 'upload' | 'download';
  taskLabels: Record<TaskType, string>;
  onToggleCreateTask: () => void;
  onTaskTypeChange: (value: TaskType) => void;
  onSourcePathChange: (value: string) => void;
  onDestinationDirectoryChange: (value: string) => void;
  onDestinationNameChange: (value: string) => void;
  onRsyncArgsChange: (value: string) => void;
  onFfmpegArgsChange: (value: string) => void;
  onFfmpegCodecChange: (value: string) => void;
  onFfmpegCqChange: (value: string) => void;
  onFfmpegOutputExtensionChange: (value: string) => void;
  onArchiveFormatChange: (value: 'zip' | 'tar' | 'tar.gz') => void;
  onChmodModeChange: (value: string) => void;
  onChmodRecursiveChange: (value: boolean) => void;
  onChownUserChange: (value: string) => void;
  onChownGroupChange: (value: string) => void;
  onChownRecursiveChange: (value: boolean) => void;
  onFtpHostChange: (value: string) => void;
  onFtpPortChange: (value: string) => void;
  onFtpUsernameChange: (value: string) => void;
  onFtpPasswordChange: (value: string) => void;
  onFtpRemotePathChange: (value: string) => void;
  onFtpDirectionChange: (value: 'upload' | 'download') => void;
  onFtpSecureChange: (value: boolean) => void;
  onSftpHostChange: (value: string) => void;
  onSftpPortChange: (value: string) => void;
  onSftpUsernameChange: (value: string) => void;
  onSftpPasswordChange: (value: string) => void;
  onSftpRemotePathChange: (value: string) => void;
  onSftpDirectionChange: (value: 'upload' | 'download') => void;
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
  rsyncArgs,
  ffmpegArgs,
  ffmpegCodec,
  ffmpegCq,
  ffmpegOutputExtension,
  archiveFormat,
  chmodMode,
  chmodRecursive,
  chownUser,
  chownGroup,
  chownRecursive,
  ftpHost,
  ftpPort,
  ftpUsername,
  ftpPassword,
  ftpRemotePath,
  ftpDirection,
  ftpSecure,
  sftpHost,
  sftpPort,
  sftpUsername,
  sftpPassword,
  sftpRemotePath,
  sftpDirection,
  taskLabels,
  onToggleCreateTask,
  onTaskTypeChange,
  onSourcePathChange,
  onDestinationDirectoryChange,
  onDestinationNameChange,
  onRsyncArgsChange,
  onFfmpegArgsChange,
  onFfmpegCodecChange,
  onFfmpegCqChange,
  onFfmpegOutputExtensionChange,
  onArchiveFormatChange,
  onChmodModeChange,
  onChmodRecursiveChange,
  onChownUserChange,
  onChownGroupChange,
  onChownRecursiveChange,
  onFtpHostChange,
  onFtpPortChange,
  onFtpUsernameChange,
  onFtpPasswordChange,
  onFtpRemotePathChange,
  onFtpDirectionChange,
  onFtpSecureChange,
  onSftpHostChange,
  onSftpPortChange,
  onSftpUsernameChange,
  onSftpPasswordChange,
  onSftpRemotePathChange,
  onSftpDirectionChange,
  onAddTask,
  onRunQueue,
  onPauseQueue,
  onRemoveTask,
  onRemoveHistoryItem,
  onCancelCreateTask
}: QueueViewProps) {
  const showDestinationDirectory =
    taskType === 'copy' ||
    taskType === 'move' ||
    taskType === 'rsync' ||
    taskType === 'ffmpeg' ||
    taskType === 'archiveCreate' ||
    taskType === 'archiveExtract' ||
    ((taskType === 'ftp' || taskType === 'sftp') && (taskType === 'ftp' ? ftpDirection === 'download' : sftpDirection === 'download'));

  const showDestinationName =
    taskType === 'copy' ||
    taskType === 'move' ||
    taskType === 'rsync' ||
    taskType === 'ffmpeg' ||
    taskType === 'archiveCreate' ||
    ((taskType === 'ftp' || taskType === 'sftp') && (taskType === 'ftp' ? ftpDirection === 'download' : sftpDirection === 'download'));

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
                <option value="rsync">Rsync</option>
                <option value="ffmpeg">FFmpeg Transcode</option>
                <option value="archiveCreate">Create Archive</option>
                <option value="archiveExtract">Extract Archive</option>
                <option value="chmod">Change Permissions (chmod)</option>
                <option value="chown">Change Ownership (chown)</option>
                <option value="ftp">FTP Transfer</option>
                <option value="sftp">SFTP Transfer</option>
              </select>
            </label>
            <FilePicker
              label="Source path"
              value={sourcePath}
              onChange={(value) => onSourcePathChange(value)}
              placeholder="/path/to/source"
              mode="fileOrDirectory"
            />
            {showDestinationDirectory && (
              <div className="destination-group">
                <FilePicker
                  label={taskType === 'archiveExtract' ? 'Extract to' : 'Destination directory'}
                  value={destinationDirectory}
                  onChange={onDestinationDirectoryChange}
                  placeholder="/path/to/destination"
                  mode="directory"
                />
                {showDestinationName && (
                  <label className="destination-name">
                    Destination name
                    <input
                      value={destinationName}
                      onChange={(event) => onDestinationNameChange(event.target.value)}
                      placeholder={getBaseName(sourcePath) || 'filename.ext'}
                    />
                  </label>
                )}
              </div>
            )}
            {taskType === 'rsync' && (
              <label>
                Rsync arguments
                <input
                  value={rsyncArgs}
                  onChange={(event) => onRsyncArgsChange(event.target.value)}
                  placeholder="-av --delete"
                />
              </label>
            )}
            {taskType === 'ffmpeg' && (
              <>
                <label>
                  Video codec
                  <select
                    value={ffmpegCodec}
                    onChange={(event) => onFfmpegCodecChange(event.target.value)}
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
                    value={ffmpegCq}
                    onChange={(event) => onFfmpegCqChange(event.target.value)}
                    placeholder="23"
                  />
                </label>
                <label>
                  FFmpeg arguments
                  <input
                    value={ffmpegArgs}
                    onChange={(event) => onFfmpegArgsChange(event.target.value)}
                    placeholder="-c:v libx265 -crf 23"
                  />
                </label>
                <label>
                  Output extension
                  <input
                    value={ffmpegOutputExtension}
                    onChange={(event) => onFfmpegOutputExtensionChange(event.target.value)}
                    placeholder=".mp4"
                  />
                </label>
              </>
            )}
            {taskType === 'archiveCreate' && (
              <label>
                Archive format
                <select
                  value={archiveFormat}
                  onChange={(event) => onArchiveFormatChange(event.target.value as 'zip' | 'tar' | 'tar.gz')}
                >
                  <option value="zip">zip</option>
                  <option value="tar">tar</option>
                  <option value="tar.gz">tar.gz</option>
                </select>
              </label>
            )}
            {taskType === 'archiveExtract' && (
              <label>
                Archive format
                <select
                  value={archiveFormat}
                  onChange={(event) => onArchiveFormatChange(event.target.value as 'zip' | 'tar' | 'tar.gz')}
                >
                  <option value="zip">zip</option>
                  <option value="tar">tar</option>
                  <option value="tar.gz">tar.gz</option>
                </select>
              </label>
            )}
            {taskType === 'chmod' && (
              <>
                <label>
                  Mode (octal)
                  <input
                    value={chmodMode}
                    onChange={(event) => onChmodModeChange(event.target.value)}
                    placeholder="644"
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={chmodRecursive}
                    onChange={(event) => onChmodRecursiveChange(event.target.checked)}
                  />
                  Recursive
                </label>
              </>
            )}
            {taskType === 'chown' && (
              <>
                <label>
                  User ID
                  <input
                    value={chownUser}
                    onChange={(event) => onChownUserChange(event.target.value)}
                    placeholder="1000"
                  />
                </label>
                <label>
                  Group ID
                  <input
                    value={chownGroup}
                    onChange={(event) => onChownGroupChange(event.target.value)}
                    placeholder="1000"
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={chownRecursive}
                    onChange={(event) => onChownRecursiveChange(event.target.checked)}
                  />
                  Recursive
                </label>
              </>
            )}
            {taskType === 'ftp' && (
              <>
                <label>
                  Direction
                  <select
                    value={ftpDirection}
                    onChange={(event) => onFtpDirectionChange(event.target.value as 'upload' | 'download')}
                  >
                    <option value="upload">Upload</option>
                    <option value="download">Download</option>
                  </select>
                </label>
                <label>
                  Host
                  <input
                    value={ftpHost}
                    onChange={(event) => onFtpHostChange(event.target.value)}
                    placeholder="ftp.example.com"
                  />
                </label>
                <label>
                  Port
                  <input
                    value={ftpPort}
                    onChange={(event) => onFtpPortChange(event.target.value)}
                    placeholder="21"
                  />
                </label>
                <label>
                  Username
                  <input
                    value={ftpUsername}
                    onChange={(event) => onFtpUsernameChange(event.target.value)}
                    placeholder="user"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={ftpPassword}
                    onChange={(event) => onFtpPasswordChange(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <label>
                  Remote path
                  <input
                    value={ftpRemotePath}
                    onChange={(event) => onFtpRemotePathChange(event.target.value)}
                    placeholder="/remote/path"
                  />
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={ftpSecure}
                    onChange={(event) => onFtpSecureChange(event.target.checked)}
                  />
                  Secure (FTPS)
                </label>
              </>
            )}
            {taskType === 'sftp' && (
              <>
                <label>
                  Direction
                  <select
                    value={sftpDirection}
                    onChange={(event) => onSftpDirectionChange(event.target.value as 'upload' | 'download')}
                  >
                    <option value="upload">Upload</option>
                    <option value="download">Download</option>
                  </select>
                </label>
                <label>
                  Host
                  <input
                    value={sftpHost}
                    onChange={(event) => onSftpHostChange(event.target.value)}
                    placeholder="sftp.example.com"
                  />
                </label>
                <label>
                  Port
                  <input
                    value={sftpPort}
                    onChange={(event) => onSftpPortChange(event.target.value)}
                    placeholder="22"
                  />
                </label>
                <label>
                  Username
                  <input
                    value={sftpUsername}
                    onChange={(event) => onSftpUsernameChange(event.target.value)}
                    placeholder="user"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={sftpPassword}
                    onChange={(event) => onSftpPasswordChange(event.target.value)}
                    placeholder="••••••"
                  />
                </label>
                <label>
                  Remote path
                  <input
                    value={sftpRemotePath}
                    onChange={(event) => onSftpRemotePathChange(event.target.value)}
                    placeholder="/remote/path"
                  />
                </label>
              </>
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
                  {entry.task.config?.rsyncArgs && (
                    <p className="muted">Args: {entry.task.config.rsyncArgs}</p>
                  )}
                  {entry.task.config?.ffmpegArgs && (
                    <p className="muted">Args: {entry.task.config.ffmpegArgs}</p>
                  )}
                  {entry.task.config?.ffmpegCodec && (
                    <p className="muted">Codec: {entry.task.config.ffmpegCodec}</p>
                  )}
                  {typeof entry.task.config?.ffmpegCq === 'number' && (
                    <p className="muted">CQ: {entry.task.config.ffmpegCq}</p>
                  )}
                  {entry.task.config?.outputExtension && (
                    <p className="muted">Output: {entry.task.config.outputExtension}</p>
                  )}
                  {entry.task.config?.archiveFormat && (
                    <p className="muted">Archive: {entry.task.config.archiveFormat}</p>
                  )}
                  {entry.task.config?.chmodMode && (
                    <p className="muted">Mode: {entry.task.config.chmodMode}</p>
                  )}
                  {(entry.task.config?.chownUser || entry.task.config?.chownGroup) && (
                    <p className="muted">
                      Owner: {entry.task.config.chownUser ?? '—'}:{entry.task.config.chownGroup ?? '—'}
                    </p>
                  )}
                  {entry.task.config?.ftpRemotePath && (
                    <p className="muted">Remote: {entry.task.config.ftpRemotePath}</p>
                  )}
                  {entry.task.config?.sftpRemotePath && (
                    <p className="muted">Remote: {entry.task.config.sftpRemotePath}</p>
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
