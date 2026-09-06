import React, { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { 
  useTasks, 
  useQueue, 
  useStartQueue, 
  usePauseQueue, 
  useResetWorkflow,
  useDeleteTask,
  useCancelTask,
  useReorderTasks
} from '../../hooks/useApi';
import { 
  ArrowLeft, 
  Plus, 
  Play, 
  Pause, 
  RefreshCw,
  Trash2,
  GripVertical,
  Copy,
  FileArchive,
  Film,
  FolderSync,
  Trash,
  Terminal,
  Archive,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Task, TaskStatus, TaskType } from '@shared/types';

interface QueueDetailProps {
  onAddTask: () => void;
  onBack: () => void;
}

export default function QueueDetail({ onAddTask, onBack }: QueueDetailProps) {
  const { selectedQueueId, tasks } = useAppStore();
  const { data: queue, isLoading: queueLoading } = useQueue(selectedQueueId);
  const { isLoading: tasksLoading } = useTasks(selectedQueueId);
  
  const startQueue = useStartQueue();
  const pauseQueue = usePauseQueue();
  const resetWorkflow = useResetWorkflow();
  const deleteTask = useDeleteTask();
  const cancelTask = useCancelTask();

  const getTaskTypeIcon = (type: TaskType) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'copy':
        return <Copy className={`${iconClass} text-blue-400`} />;
      case 'zip':
        return <FileArchive className={`${iconClass} text-yellow-400`} />;
      case 'tar':
        return <Archive className={`${iconClass} text-orange-400`} />;
      case 'transcode':
        return <Film className={`${iconClass} text-purple-400`} />;
      case 'rsync':
        return <FolderSync className={`${iconClass} text-green-400`} />;
      case 'delete':
        return <Trash className={`${iconClass} text-red-400`} />;
      case 'custom':
        return <Terminal className={`${iconClass} text-cyan-400`} />;
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'border-emerald-500/30 bg-emerald-500/10';
      case 'failed':
        return 'border-red-500/30 bg-red-500/10';
      case 'running':
        return 'border-cyan-500/30 bg-cyan-500/10';
      case 'cancelled':
        return 'border-amber-500/30 bg-amber-500/10';
      default:
        return 'border-surface-light bg-surface-dark';
    }
  };

  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (confirm(`Delete task "${taskName}"?`)) {
      await deleteTask.mutateAsync(taskId);
    }
  };

  const handleCancel = async () => {
    if (selectedQueueId && confirm('Cancel the current running task?')) {
      await cancelTask.mutateAsync(selectedQueueId);
    }
  };

  if (queueLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Queue not found</p>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const runningTask = tasks.find(t => t.status === 'running');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-surface-light">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-surface-light transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-100">{queue.name}</h1>
              <span className={`
                px-2 py-0.5 rounded text-xs font-medium capitalize
                ${queue.status === 'running' ? 'bg-emerald-500/20 text-emerald-400' :
                  queue.status === 'paused' ? 'bg-amber-500/20 text-amber-400' : 
                  'bg-gray-500/20 text-gray-400'}
              `}>
                {queue.status}
              </span>
              <span className={`
                px-2 py-0.5 rounded text-xs font-medium capitalize
                ${queue.type === 'workflow' ? 'bg-purple-500/20 text-purple-400' : 
                  'bg-emerald-500/20 text-emerald-400'}
              `}>
                {queue.type}
              </span>
            </div>
            {queue.description && (
              <p className="text-sm text-gray-400 mt-1">{queue.description}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {queue.status === 'running' && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                disabled={cancelTask.isPending}
              >
                <XCircle className="w-4 h-4" />
                Cancel Current
              </button>
            )}
            
            {queue.status === 'paused' || queue.status === 'idle' ? (
              <button
                onClick={() => startQueue.mutate(queue.id)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-surface-dark font-semibold rounded-lg transition-colors"
                disabled={startQueue.isPending || tasks.length === 0}
              >
                <Play className="w-4 h-4" />
                Start
              </button>
            ) : (
              <button
                onClick={() => pauseQueue.mutate(queue.id)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-surface-dark font-semibold rounded-lg transition-colors"
                disabled={pauseQueue.isPending}
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            
            {queue.type === 'workflow' && (
              <button
                onClick={() => resetWorkflow.mutate(queue.id)}
                className="flex items-center gap-2 px-3 py-2 bg-surface-light hover:bg-surface-lighter text-gray-300 rounded-lg transition-colors"
                disabled={resetWorkflow.isPending || queue.status === 'running'}
                title="Reset all tasks to pending"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            )}
            
            <button
              onClick={onAddTask}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-surface-dark font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 text-sm">
          <span className="text-gray-400">
            <span className="font-semibold text-gray-200">{tasks.length}</span> total tasks
          </span>
          <span className="text-gray-400">
            <span className="font-semibold text-emerald-400">{completedTasks}</span> completed
          </span>
          <span className="text-gray-400">
            <span className="font-semibold text-amber-400">{pendingTasks}</span> pending
          </span>
          {failedTasks > 0 && (
            <span className="text-gray-400">
              <span className="font-semibold text-red-400">{failedTasks}</span> failed
            </span>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-surface-dark rounded-full mb-4">
              <Plus className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No tasks yet</h3>
            <p className="text-gray-500 mb-4">Add tasks to this {queue.type} to get started</p>
            <button
              onClick={onAddTask}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-surface-dark font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                getTaskTypeIcon={getTaskTypeIcon}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                onDelete={() => handleDeleteTask(task.id, task.name)}
                isDeleting={deleteTask.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  index: number;
  getTaskTypeIcon: (type: TaskType) => React.ReactNode;
  getStatusIcon: (status: TaskStatus) => React.ReactNode;
  getStatusColor: (status: TaskStatus) => string;
  onDelete: () => void;
  isDeleting: boolean;
}

function TaskCard({ 
  task, 
  index, 
  getTaskTypeIcon, 
  getStatusIcon, 
  getStatusColor,
  onDelete,
  isDeleting 
}: TaskCardProps) {
  const getTaskSummary = (task: Task): string => {
    const config = task.config;
    switch (config.type) {
      case 'copy':
        return `${config.source} → ${config.destination}`;
      case 'zip':
        return `${config.inputs.length} item(s) → ${config.output}`;
      case 'tar':
        return `${config.inputs.length} item(s) → ${config.output}${config.gzip ? ' (gzipped)' : ''}`;
      case 'transcode':
        return `${config.input} → ${config.output}`;
      case 'rsync':
        return `${config.source} → ${config.destination}`;
      case 'delete':
        return `${config.paths.length} item(s)${config.moveToTrash ? ' to trash' : ''}`;
      case 'custom':
        return config.command;
    }
  };

  return (
    <div className={`
      rounded-xl border p-4 transition-all
      ${getStatusColor(task.status)}
    `}>
      <div className="flex items-start gap-4">
        {/* Drag handle */}
        <div className="pt-1 cursor-grab opacity-50 hover:opacity-100">
          <GripVertical className="w-4 h-4 text-gray-500" />
        </div>

        {/* Index */}
        <div className="w-8 h-8 rounded-full bg-surface-darker flex items-center justify-center text-sm font-mono text-gray-400">
          {index + 1}
        </div>

        {/* Task type icon */}
        <div className="pt-1">
          {getTaskTypeIcon(task.config.type)}
        </div>

        {/* Task info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-100 truncate">{task.name}</h3>
            <span className="text-xs text-gray-500 capitalize px-1.5 py-0.5 bg-surface-darker rounded">
              {task.config.type}
            </span>
          </div>
          <p className="text-sm text-gray-400 truncate">{getTaskSummary(task)}</p>
          
          {/* Progress bar for running tasks */}
          {task.status === 'running' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{task.progressMessage || 'Processing...'}</span>
                <span>{Math.round(task.progress)}%</span>
              </div>
              <div className="h-2 bg-surface-darker rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {task.status === 'failed' && task.error && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400">{task.error}</p>
            </div>
          )}
        </div>

        {/* Status and actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {getStatusIcon(task.status)}
            <span className={`
              text-xs font-medium capitalize
              ${task.status === 'completed' ? 'text-emerald-400' :
                task.status === 'failed' ? 'text-red-400' :
                task.status === 'running' ? 'text-cyan-400' :
                task.status === 'cancelled' ? 'text-amber-400' : 'text-gray-400'}
            `}>
              {task.status}
            </span>
          </div>

          {task.status !== 'running' && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-surface-darker transition-colors opacity-50 hover:opacity-100"
              disabled={isDeleting}
              title="Delete task"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
