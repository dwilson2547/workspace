import type { TaskInfo, TaskProgress } from '../types';
import { formatBytes, formatDate } from '../api';
import { TrashIcon, GripIcon, TaskTypeIcon } from './Icons';

interface TaskItemProps {
  task: TaskInfo;
  progress?: TaskProgress;
  onDelete: () => void;
  isDragging?: boolean;
}

export function TaskItem({ task, progress, onDelete, isDragging }: TaskItemProps) {
  const isRunning = task.status === 'running';
  const isPending = task.status === 'pending';

  // Get task summary based on type
  const getTaskSummary = () => {
    const config = task.config as any;
    switch (task.task_type) {
      case 'copy':
        return `${config.source} → ${config.destination}`;
      case 'zip':
        return `${config.inputs?.length || 0} items → ${config.output}`;
      case 'tar':
        return `${config.inputs?.length || 0} items → ${config.output}${config.gzip ? ' (gzip)' : ''}`;
      case 'transcode':
        return `${config.input} → ${config.output} [${config.codec}]`;
      default:
        return 'Unknown task';
    }
  };

  // Get icon background class based on task type
  const getIconClass = () => {
    switch (task.task_type) {
      case 'copy':
        return 'task-icon-copy';
      case 'zip':
        return 'task-icon-zip';
      case 'tar':
        return 'task-icon-tar';
      case 'transcode':
        return 'task-icon-transcode';
      default:
        return 'task-icon-copy';
    }
  };

  return (
    <div
      className={`
        group relative bg-surface-800 rounded-lg border transition-all
        ${isRunning ? 'border-accent/50 bg-surface-700/50' : 'border-surface-700'}
        ${isDragging ? 'opacity-50 scale-[0.98]' : ''}
        ${isPending ? 'hover:border-surface-600' : ''}
      `}
    >
      {/* Running glow effect */}
      {isRunning && (
        <div className="absolute inset-0 rounded-lg bg-accent/5 pointer-events-none" />
      )}

      <div className="p-3 relative">
        <div className="flex items-start gap-3">
          {/* Drag handle (only for pending tasks) */}
          {isPending && (
            <div className="cursor-grab opacity-0 group-hover:opacity-50 hover:!opacity-100 text-gray-500 mt-1">
              <GripIcon size={16} />
            </div>
          )}

          {/* Task type icon */}
          <div className={`${getIconClass()} flex-shrink-0`}>
            <TaskTypeIcon type={task.task_type} size={16} />
          </div>

          {/* Task content */}
          <div className="flex-1 min-w-0">
            {/* Task type label */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">
                {task.task_type}
              </span>
              
              {/* Status badge */}
              {isRunning && (
                <span className="badge-running">
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />
                  Running
                </span>
              )}
              {isPending && (
                <span className="badge-idle">
                  #{task.position + 1}
                </span>
              )}
            </div>

            {/* Task summary */}
            <p className="text-sm text-gray-400 truncate font-mono">
              {getTaskSummary()}
            </p>

            {/* Progress bar for running tasks */}
            {isRunning && progress && (
              <div className="mt-2">
                <div className="progress-bar">
                  {progress.percentage != null ? (
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(100, progress.percentage)}%` }}
                    />
                  ) : (
                    <div className="progress-bar-indeterminate" />
                  )}
                </div>
                
                <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                  <span className="truncate max-w-[60%]">
                    {progress.message || progress.current_file || 'Processing...'}
                  </span>
                  <span className="flex-shrink-0 ml-2">
                    {formatBytes(progress.bytes_processed)}
                    {progress.percentage != null && ` · ${progress.percentage.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            )}

            {/* Timestamp */}
            <p className="text-[10px] text-gray-600 mt-1.5">
              Added {formatDate(task.created_at)}
            </p>
          </div>

          {/* Delete button (only for pending tasks) */}
          {isPending && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-status-error hover:bg-status-error/10 transition-all"
              title="Remove task"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Empty state component
export function TasksEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center mb-4">
        <span className="text-2xl">📋</span>
      </div>
      <h3 className="text-lg font-medium text-gray-300 mb-1">No tasks yet</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Add a task to this queue using the buttons above
      </p>
    </div>
  );
}
