import { useEffect, useMemo, useState } from 'react';
import type { ElectronAPI, DirectoryWatcherConfig, Queue, TaskType, Workflow } from '@shared/types';
import Sidebar from './components/Sidebar';
import QueueView from './components/QueueView';
import WorkflowView from './components/WorkflowView';
import { defaultWatcherConfig, getBaseName, joinPath, taskLabels } from './utils/formatters';

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
            onAddTask={handleAddTask}
            onRunQueue={handleRunQueue}
            onPauseQueue={handlePauseQueue}
            onRemoveTask={handleRemoveTask}
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
