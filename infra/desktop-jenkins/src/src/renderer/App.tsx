import { useEffect, useMemo, useState } from 'react';
import type { ElectronAPI, DirectoryWatcherConfig, Queue, TaskType, Workflow } from '@shared/types';
import Sidebar from './components/Sidebar';
import QueueView from './components/QueueView';
import WorkflowView from './components/WorkflowView';
import { defaultWatcherConfig, getBaseName, joinPath, replaceExtension, taskLabels } from './utils/formatters';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

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
  const [rsyncArgs, setRsyncArgs] = useState('');
  const [ffmpegArgs, setFfmpegArgs] = useState('');
  const [ffmpegCodec, setFfmpegCodec] = useState('libx264');
  const [ffmpegCq, setFfmpegCq] = useState('');
  const [ffmpegOutputExtension, setFfmpegOutputExtension] = useState('.mp4');
  const [archiveFormat, setArchiveFormat] = useState<'zip' | 'tar' | 'tar.gz'>('zip');
  const [chmodMode, setChmodMode] = useState('');
  const [chmodRecursive, setChmodRecursive] = useState(false);
  const [chownUser, setChownUser] = useState('');
  const [chownGroup, setChownGroup] = useState('');
  const [chownRecursive, setChownRecursive] = useState(false);
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState('21');
  const [ftpUsername, setFtpUsername] = useState('');
  const [ftpPassword, setFtpPassword] = useState('');
  const [ftpRemotePath, setFtpRemotePath] = useState('');
  const [ftpDirection, setFtpDirection] = useState<'upload' | 'download'>('upload');
  const [ftpSecure, setFtpSecure] = useState(false);
  const [sftpHost, setSftpHost] = useState('');
  const [sftpPort, setSftpPort] = useState('22');
  const [sftpUsername, setSftpUsername] = useState('');
  const [sftpPassword, setSftpPassword] = useState('');
  const [sftpRemotePath, setSftpRemotePath] = useState('');
  const [sftpDirection, setSftpDirection] = useState<'upload' | 'download'>('upload');
  const [isCreatingWorkflowTask, setIsCreatingWorkflowTask] = useState(false);
  const [workflowTaskType, setWorkflowTaskType] = useState<TaskType>('copy');
  const [workflowDestinationDirectory, setWorkflowDestinationDirectory] = useState('');
  const [workflowDestinationName, setWorkflowDestinationName] = useState('');
  const [workflowRsyncArgs, setWorkflowRsyncArgs] = useState('');
  const [workflowFfmpegArgs, setWorkflowFfmpegArgs] = useState('');
  const [workflowFfmpegCodec, setWorkflowFfmpegCodec] = useState('libx264');
  const [workflowFfmpegCq, setWorkflowFfmpegCq] = useState('');
  const [workflowOutputExtension, setWorkflowOutputExtension] = useState('.mp4');
  const [workflowArchiveFormat, setWorkflowArchiveFormat] = useState<'zip' | 'tar' | 'tar.gz'>('zip');
  const [workflowChmodMode, setWorkflowChmodMode] = useState('');
  const [workflowChmodRecursive, setWorkflowChmodRecursive] = useState(false);
  const [workflowChownUser, setWorkflowChownUser] = useState('');
  const [workflowChownGroup, setWorkflowChownGroup] = useState('');
  const [workflowChownRecursive, setWorkflowChownRecursive] = useState(false);
  const [workflowFtpHost, setWorkflowFtpHost] = useState('');
  const [workflowFtpPort, setWorkflowFtpPort] = useState('21');
  const [workflowFtpUsername, setWorkflowFtpUsername] = useState('');
  const [workflowFtpPassword, setWorkflowFtpPassword] = useState('');
  const [workflowFtpRemotePath, setWorkflowFtpRemotePath] = useState('');
  const [workflowFtpSecure, setWorkflowFtpSecure] = useState(false);
  const [workflowSftpHost, setWorkflowSftpHost] = useState('');
  const [workflowSftpPort, setWorkflowSftpPort] = useState('22');
  const [workflowSftpUsername, setWorkflowSftpUsername] = useState('');
  const [workflowSftpPassword, setWorkflowSftpPassword] = useState('');
  const [workflowSftpRemotePath, setWorkflowSftpRemotePath] = useState('');
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
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedWorkflowId) {
        refreshWorkflows();
        return;
      }
      if (selectedQueueId) {
        refreshQueues();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedQueueId, selectedWorkflowId]);

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
    const trimmedSource = sourcePath.trim();
    const trimmedDestinationDirectory = destinationDirectory.trim();
    const trimmedDestinationName = destinationName.trim();
    const isFtpDownload = taskType === 'ftp' && ftpDirection === 'download';
    const isSftpDownload = taskType === 'sftp' && sftpDirection === 'download';
    if (!trimmedSource && !isFtpDownload && !isSftpDownload) {
      return;
    }

    const baseName = getBaseName(trimmedSource);
    const archiveExtension = archiveFormat === 'tar.gz' ? '.tar.gz' : `.${archiveFormat}`;
    const buildDestinationPath = (fallbackName = baseName) =>
      trimmedDestinationDirectory
        ? joinPath(trimmedDestinationDirectory, trimmedDestinationName || fallbackName)
        : '';

    let destinationPath: string | undefined;

    if (taskType === 'copy' || taskType === 'move' || taskType === 'rsync') {
      if (!trimmedDestinationDirectory) {
        return;
      }
      destinationPath = buildDestinationPath(baseName);
    } else if (taskType === 'ffmpeg') {
      if (!trimmedDestinationDirectory) {
        return;
      }
      const outputName = trimmedDestinationName || replaceExtension(baseName, ffmpegOutputExtension || '.mp4');
      destinationPath = joinPath(trimmedDestinationDirectory, outputName);
    } else if (taskType === 'archiveCreate') {
      if (!trimmedDestinationDirectory) {
        return;
      }
      const defaultArchiveName = baseName.includes('.')
        ? `${baseName.slice(0, Math.max(0, baseName.lastIndexOf('.')))}${archiveExtension}`
        : `${baseName}${archiveExtension}`;
      destinationPath = buildDestinationPath(defaultArchiveName);
    } else if (taskType === 'archiveExtract') {
      if (!trimmedDestinationDirectory) {
        return;
      }
      destinationPath = trimmedDestinationDirectory;
    } else if (taskType === 'ftp' && ftpDirection === 'download') {
      if (!trimmedDestinationDirectory) {
        return;
      }
      const fallbackName = getBaseName(ftpRemotePath) || baseName;
      destinationPath = buildDestinationPath(fallbackName);
    } else if (taskType === 'sftp' && sftpDirection === 'download') {
      if (!trimmedDestinationDirectory) {
        return;
      }
      const fallbackName = getBaseName(sftpRemotePath) || baseName;
      destinationPath = buildDestinationPath(fallbackName);
    }

    if (taskType === 'chmod' && !chmodMode.trim()) {
      return;
    }
    if (taskType === 'chown' && (!chownUser.trim() || !chownGroup.trim())) {
      return;
    }
    if (taskType === 'ftp' && (!ftpHost.trim() || !ftpUsername.trim() || !ftpPassword || !ftpRemotePath.trim())) {
      return;
    }
    if (taskType === 'sftp' && (!sftpHost.trim() || !sftpUsername.trim() || !sftpPassword || !sftpRemotePath.trim())) {
      return;
    }

    const effectiveSourcePath = trimmedSource || destinationPath || '';
    if (!effectiveSourcePath) {
      return;
    }

    const parsedFfmpegCq = ffmpegCq.trim() ? Number(ffmpegCq) : undefined;

    await api.addTask(selectedQueue.id, {
      name: `${taskLabels[taskType]} Task`,
      type: taskType,
      config: {
        sourcePath: effectiveSourcePath,
        destinationPath,
        rsyncArgs: rsyncArgs.trim() || undefined,
        ffmpegArgs: ffmpegArgs.trim() || undefined,
        ffmpegCodec: ffmpegCodec.trim() || undefined,
        ffmpegCq: Number.isFinite(parsedFfmpegCq ?? NaN) ? parsedFfmpegCq : undefined,
        outputExtension: ffmpegOutputExtension.trim() || undefined,
        archiveFormat,
        chmodMode: chmodMode.trim() || undefined,
        chmodRecursive,
        chownUser: chownUser.trim() || undefined,
        chownGroup: chownGroup.trim() || undefined,
        chownRecursive,
        ftpHost: ftpHost.trim() || undefined,
        ftpPort: ftpPort ? Number(ftpPort) : undefined,
        ftpUsername: ftpUsername.trim() || undefined,
        ftpPassword: ftpPassword || undefined,
        ftpRemotePath: ftpRemotePath.trim() || undefined,
        ftpDirection,
        ftpSecure,
        sftpHost: sftpHost.trim() || undefined,
        sftpPort: sftpPort ? Number(sftpPort) : undefined,
        sftpUsername: sftpUsername.trim() || undefined,
        sftpPassword: sftpPassword || undefined,
        sftpRemotePath: sftpRemotePath.trim() || undefined,
        sftpDirection
      }
    });

    setSourcePath('');
    setDestinationDirectory('');
    setDestinationName('');
    setRsyncArgs('');
    setFfmpegArgs('');
    setFfmpegCodec('libx264');
    setFfmpegCq('');
    setFfmpegOutputExtension('.mp4');
    setArchiveFormat('zip');
    setChmodMode('');
    setChmodRecursive(false);
    setChownUser('');
    setChownGroup('');
    setChownRecursive(false);
    setFtpHost('');
    setFtpPort('21');
    setFtpUsername('');
    setFtpPassword('');
    setFtpRemotePath('');
    setFtpDirection('upload');
    setFtpSecure(false);
    setSftpHost('');
    setSftpPort('22');
    setSftpUsername('');
    setSftpPassword('');
    setSftpRemotePath('');
    setSftpDirection('upload');
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

  const handleRemoveQueueHistoryItem = async (historyId: string) => {
    if (!api || !selectedQueue) {
      return;
    }
    await api.removeQueueHistoryItem(selectedQueue.id, historyId);
    refreshQueues();
  };

  const handleAddWorkflowTask = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    const trimmedDestinationDirectory = workflowDestinationDirectory.trim();
    const trimmedDestinationName = workflowDestinationName.trim();

    if (
      (workflowTaskType === 'copy' ||
        workflowTaskType === 'move' ||
        workflowTaskType === 'rsync' ||
        workflowTaskType === 'ffmpeg' ||
        workflowTaskType === 'archiveCreate' ||
        workflowTaskType === 'archiveExtract') &&
      !trimmedDestinationDirectory
    ) {
      return;
    }
    if (workflowTaskType === 'chmod' && !workflowChmodMode.trim()) {
      return;
    }
    if (workflowTaskType === 'chown' && (!workflowChownUser.trim() || !workflowChownGroup.trim())) {
      return;
    }
    if (
      workflowTaskType === 'ftp' &&
      (!workflowFtpHost.trim() || !workflowFtpUsername.trim() || !workflowFtpPassword || !workflowFtpRemotePath.trim())
    ) {
      return;
    }
    if (
      workflowTaskType === 'sftp' &&
      (!workflowSftpHost.trim() || !workflowSftpUsername.trim() || !workflowSftpPassword || !workflowSftpRemotePath.trim())
    ) {
      return;
    }
    const parsedWorkflowFfmpegCq = workflowFfmpegCq.trim() ? Number(workflowFfmpegCq) : undefined;

    await api.addWorkflowTask(selectedWorkflow.id, {
      name: `${taskLabels[workflowTaskType]} Step`,
      type: workflowTaskType,
      config: {
        destinationDirectory: trimmedDestinationDirectory || undefined,
        destinationName: trimmedDestinationName || undefined,
        rsyncArgs: workflowRsyncArgs.trim() || undefined,
        ffmpegArgs: workflowFfmpegArgs.trim() || undefined,
        ffmpegCodec: workflowFfmpegCodec.trim() || undefined,
        ffmpegCq: Number.isFinite(parsedWorkflowFfmpegCq ?? NaN) ? parsedWorkflowFfmpegCq : undefined,
        outputExtension: workflowOutputExtension.trim() || undefined,
        archiveFormat: workflowArchiveFormat,
        chmodMode: workflowChmodMode.trim() || undefined,
        chmodRecursive: workflowChmodRecursive,
        chownUser: workflowChownUser.trim() || undefined,
        chownGroup: workflowChownGroup.trim() || undefined,
        chownRecursive: workflowChownRecursive,
        ftpHost: workflowFtpHost.trim() || undefined,
        ftpPort: workflowFtpPort ? Number(workflowFtpPort) : undefined,
        ftpUsername: workflowFtpUsername.trim() || undefined,
        ftpPassword: workflowFtpPassword || undefined,
        ftpRemotePath: workflowFtpRemotePath.trim() || undefined,
        ftpSecure: workflowFtpSecure,
        sftpHost: workflowSftpHost.trim() || undefined,
        sftpPort: workflowSftpPort ? Number(workflowSftpPort) : undefined,
        sftpUsername: workflowSftpUsername.trim() || undefined,
        sftpPassword: workflowSftpPassword || undefined,
        sftpRemotePath: workflowSftpRemotePath.trim() || undefined
      }
    });

    setWorkflowTaskType('copy');
    setWorkflowDestinationDirectory('');
    setWorkflowDestinationName('');
    setWorkflowRsyncArgs('');
    setWorkflowFfmpegArgs('');
    setWorkflowFfmpegCodec('libx264');
    setWorkflowFfmpegCq('');
    setWorkflowOutputExtension('.mp4');
    setWorkflowArchiveFormat('zip');
    setWorkflowChmodMode('');
    setWorkflowChmodRecursive(false);
    setWorkflowChownUser('');
    setWorkflowChownGroup('');
    setWorkflowChownRecursive(false);
    setWorkflowFtpHost('');
    setWorkflowFtpPort('21');
    setWorkflowFtpUsername('');
    setWorkflowFtpPassword('');
    setWorkflowFtpRemotePath('');
    setWorkflowFtpSecure(false);
    setWorkflowSftpHost('');
    setWorkflowSftpPort('22');
    setWorkflowSftpUsername('');
    setWorkflowSftpPassword('');
    setWorkflowSftpRemotePath('');
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

  const handleRemoveWorkflowFile = async (fileId: string) => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.removeWorkflowFile(selectedWorkflow.id, fileId);
    refreshWorkflows();
  };

  const handleRemoveWorkflowHistoryItem = async (historyId: string) => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.removeWorkflowHistoryItem(selectedWorkflow.id, historyId);
    refreshWorkflows();
  };

  const handleClearWorkflowHistory = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.clearWorkflowHistory(selectedWorkflow.id);
    refreshWorkflows();
  };

  const handleExportWorkflowHistory = async () => {
    if (!api || !selectedWorkflow) {
      return;
    }
    await api.exportWorkflowHistory(selectedWorkflow.id);
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
      <Sidebar
        queues={queues}
        workflows={workflows}
        selectedQueueId={selectedQueueId}
        selectedWorkflowId={selectedWorkflowId}
        isCreatingQueue={isCreatingQueue}
        queueName={queueName}
        onQueueNameChange={setQueueName}
        onCreateQueue={handleCreateQueue}
        onToggleCreateQueue={() => setIsCreatingQueue((prev) => !prev)}
        onCancelCreateQueue={() => setIsCreatingQueue(false)}
        isCreatingWorkflow={isCreatingWorkflow}
        workflowName={workflowName}
        onWorkflowNameChange={setWorkflowName}
        onCreateWorkflow={handleCreateWorkflow}
        onToggleCreateWorkflow={() => setIsCreatingWorkflow((prev) => !prev)}
        onCancelCreateWorkflow={() => setIsCreatingWorkflow(false)}
        onSelectQueue={(queueId) => {
          setSelectedQueueId(queueId);
          setSelectedWorkflowId(null);
        }}
        onSelectWorkflow={(workflowId) => {
          setSelectedWorkflowId(workflowId);
          setSelectedQueueId(null);
        }}
      />

      <main className="content">
        {selectedWorkflow ? (
          <WorkflowView
            workflow={selectedWorkflow}
            isCreatingWorkflowTask={isCreatingWorkflowTask}
            workflowTaskType={workflowTaskType}
            workflowDestinationDirectory={workflowDestinationDirectory}
            taskLabels={taskLabels}
            watcherConfig={watcherConfig}
            onToggleCreateWorkflowTask={() => setIsCreatingWorkflowTask((prev) => !prev)}
            onWorkflowTaskTypeChange={setWorkflowTaskType}
            onWorkflowDestinationDirectoryChange={setWorkflowDestinationDirectory}
            onWorkflowDestinationNameChange={setWorkflowDestinationName}
            onWorkflowRsyncArgsChange={setWorkflowRsyncArgs}
            onWorkflowFfmpegArgsChange={setWorkflowFfmpegArgs}
            onWorkflowFfmpegCodecChange={setWorkflowFfmpegCodec}
            onWorkflowFfmpegCqChange={setWorkflowFfmpegCq}
            onWorkflowOutputExtensionChange={setWorkflowOutputExtension}
            onWorkflowArchiveFormatChange={setWorkflowArchiveFormat}
            onWorkflowChmodModeChange={setWorkflowChmodMode}
            onWorkflowChmodRecursiveChange={setWorkflowChmodRecursive}
            onWorkflowChownUserChange={setWorkflowChownUser}
            onWorkflowChownGroupChange={setWorkflowChownGroup}
            onWorkflowChownRecursiveChange={setWorkflowChownRecursive}
            onWorkflowFtpHostChange={setWorkflowFtpHost}
            onWorkflowFtpPortChange={setWorkflowFtpPort}
            onWorkflowFtpUsernameChange={setWorkflowFtpUsername}
            onWorkflowFtpPasswordChange={setWorkflowFtpPassword}
            onWorkflowFtpRemotePathChange={setWorkflowFtpRemotePath}
            onWorkflowFtpSecureChange={setWorkflowFtpSecure}
            onWorkflowSftpHostChange={setWorkflowSftpHost}
            onWorkflowSftpPortChange={setWorkflowSftpPort}
            onWorkflowSftpUsernameChange={setWorkflowSftpUsername}
            onWorkflowSftpPasswordChange={setWorkflowSftpPassword}
            onWorkflowSftpRemotePathChange={setWorkflowSftpRemotePath}
            workflowDestinationName={workflowDestinationName}
            workflowRsyncArgs={workflowRsyncArgs}
            workflowFfmpegArgs={workflowFfmpegArgs}
            workflowFfmpegCodec={workflowFfmpegCodec}
            workflowFfmpegCq={workflowFfmpegCq}
            workflowOutputExtension={workflowOutputExtension}
            workflowArchiveFormat={workflowArchiveFormat}
            workflowChmodMode={workflowChmodMode}
            workflowChmodRecursive={workflowChmodRecursive}
            workflowChownUser={workflowChownUser}
            workflowChownGroup={workflowChownGroup}
            workflowChownRecursive={workflowChownRecursive}
            workflowFtpHost={workflowFtpHost}
            workflowFtpPort={workflowFtpPort}
            workflowFtpUsername={workflowFtpUsername}
            workflowFtpPassword={workflowFtpPassword}
            workflowFtpRemotePath={workflowFtpRemotePath}
            workflowFtpSecure={workflowFtpSecure}
            workflowSftpHost={workflowSftpHost}
            workflowSftpPort={workflowSftpPort}
            workflowSftpUsername={workflowSftpUsername}
            workflowSftpPassword={workflowSftpPassword}
            workflowSftpRemotePath={workflowSftpRemotePath}
            onAddWorkflowTask={handleAddWorkflowTask}
            onRemoveWorkflowTask={handleRemoveWorkflowTask}
            onAddWorkflowFiles={handleAddWorkflowFiles}
            onAddWorkflowFolder={handleAddWorkflowFolder}
            onRunWorkflow={handleRunWorkflow}
            onPauseWorkflow={handlePauseWorkflow}
            onUpdateWorkflowSettings={handleUpdateWorkflowSettings}
            onRemoveWorkflowFile={handleRemoveWorkflowFile}
            onRemoveWorkflowHistoryItem={handleRemoveWorkflowHistoryItem}
            onClearWorkflowHistory={handleClearWorkflowHistory}
            onExportWorkflowHistory={handleExportWorkflowHistory}
            onSaveWatcherConfig={handleSaveWatcherConfig}
            onStartWatcher={handleStartWatcher}
            onStopWatcher={handleStopWatcher}
            onWatcherConfigChange={setWatcherConfig}
          />
        ) : selectedQueue ? (
          <QueueView
            queue={selectedQueue}
            isCreatingTask={isCreatingTask}
            taskType={taskType}
            sourcePath={sourcePath}
            destinationDirectory={destinationDirectory}
            destinationName={destinationName}
            taskLabels={taskLabels}
            onToggleCreateTask={() => setIsCreatingTask((prev) => !prev)}
            onTaskTypeChange={setTaskType}
            onSourcePathChange={(value) => {
              setSourcePath(value);
              if (!destinationName) {
                setDestinationName(getBaseName(value));
              }
            }}
            onDestinationDirectoryChange={setDestinationDirectory}
            onDestinationNameChange={setDestinationName}
            onRsyncArgsChange={setRsyncArgs}
            onFfmpegArgsChange={setFfmpegArgs}
            onFfmpegCodecChange={setFfmpegCodec}
            onFfmpegCqChange={setFfmpegCq}
            onFfmpegOutputExtensionChange={setFfmpegOutputExtension}
            onArchiveFormatChange={setArchiveFormat}
            onChmodModeChange={setChmodMode}
            onChmodRecursiveChange={setChmodRecursive}
            onChownUserChange={setChownUser}
            onChownGroupChange={setChownGroup}
            onChownRecursiveChange={setChownRecursive}
            onFtpHostChange={setFtpHost}
            onFtpPortChange={setFtpPort}
            onFtpUsernameChange={setFtpUsername}
            onFtpPasswordChange={setFtpPassword}
            onFtpRemotePathChange={setFtpRemotePath}
            onFtpDirectionChange={setFtpDirection}
            onFtpSecureChange={setFtpSecure}
            onSftpHostChange={setSftpHost}
            onSftpPortChange={setSftpPort}
            onSftpUsernameChange={setSftpUsername}
            onSftpPasswordChange={setSftpPassword}
            onSftpRemotePathChange={setSftpRemotePath}
            onSftpDirectionChange={setSftpDirection}
            onAddTask={handleAddTask}
            onRunQueue={handleRunQueue}
            onPauseQueue={handlePauseQueue}
            onRemoveTask={handleRemoveTask}
            rsyncArgs={rsyncArgs}
            ffmpegArgs={ffmpegArgs}
            ffmpegCodec={ffmpegCodec}
            ffmpegCq={ffmpegCq}
            ffmpegOutputExtension={ffmpegOutputExtension}
            archiveFormat={archiveFormat}
            chmodMode={chmodMode}
            chmodRecursive={chmodRecursive}
            chownUser={chownUser}
            chownGroup={chownGroup}
            chownRecursive={chownRecursive}
            ftpHost={ftpHost}
            ftpPort={ftpPort}
            ftpUsername={ftpUsername}
            ftpPassword={ftpPassword}
            ftpRemotePath={ftpRemotePath}
            ftpDirection={ftpDirection}
            ftpSecure={ftpSecure}
            sftpHost={sftpHost}
            sftpPort={sftpPort}
            sftpUsername={sftpUsername}
            sftpPassword={sftpPassword}
            sftpRemotePath={sftpRemotePath}
            sftpDirection={sftpDirection}
            onRemoveHistoryItem={handleRemoveQueueHistoryItem}
            onCancelCreateTask={() => setIsCreatingTask(false)}
          />
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
