import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { QueueInfo, TaskProgress } from '../types';
import { formatBytes } from '../api';
import {
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ChevronRightIcon,
  TaskTypeIcon,
} from './Icons';

interface QueueCardProps {
  queue: QueueInfo;
  isSelected: boolean;
  progress?: TaskProgress;
  onSelect: () => void;
  onResume: () => void;
  onPause: () => void;
  onDelete: () => void;
}

export function QueueCard({
  queue,
  isSelected,
  progress,
  onSelect,
  onResume,
  onPause,
  onDelete,
}: QueueCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isRunning = queue.status === 'running';

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    
    if (confirm(`Delete queue "${queue.name}" and all its tasks?`)) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      onPause();
    } else {
      onResume();
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`
        card-hover cursor-pointer group relative overflow-hidden
        ${isSelected ? 'border-accent bg-surface-700/50 ring-1 ring-accent/30' : ''}
      `}
    >
      {/* Running indicator bar */}
      {isRunning && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent/50">
          <div className="h-full w-1/3 bg-accent animate-progress-indeterminate" />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Status indicator */}
            <div
              className={`
                w-2.5 h-2.5 rounded-full flex-shrink-0
                ${isRunning ? 'bg-status-running animate-pulse' : 'bg-status-idle'}
              `}
            />
            
            {/* Queue name */}
            <h3 className="font-semibold text-gray-100 truncate">
              {queue.name}
            </h3>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleToggle}
              disabled={queue.pending_count === 0 && !isRunning}
              className={`
                p-1.5 rounded-lg transition-colors
                ${isRunning 
                  ? 'text-status-warning hover:bg-status-warning/20' 
                  : 'text-status-success hover:bg-status-success/20'
                }
                disabled:opacity-30 disabled:cursor-not-allowed
              `}
              title={isRunning ? 'Pause queue' : 'Resume queue'}
            >
              {isRunning ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-lg text-gray-500 hover:text-status-error hover:bg-status-error/10 transition-colors"
              title="Delete queue"
            >
              <TrashIcon size={16} />
            </button>
          </div>
        </div>

        {/* Current task progress */}
        {isRunning && queue.current_task && (
          <div className="mb-3 p-2 bg-surface-900/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
              <div className="task-icon-copy w-5 h-5 text-[10px]">
                <TaskTypeIcon type={queue.current_task.task_type} size={12} />
              </div>
              <span className="truncate flex-1">
                {progress?.current_file || 'Processing...'}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="progress-bar">
              {progress?.percentage != null ? (
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, progress.percentage)}%` }}
                />
              ) : (
                <div className="progress-bar-indeterminate" />
              )}
            </div>
            
            {progress && (
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>{formatBytes(progress.bytes_processed)}</span>
                {progress.percentage != null && (
                  <span>{progress.percentage.toFixed(1)}%</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-400">
            <span>
              <span className="text-gray-200 font-medium">{queue.pending_count}</span>
              {' '}pending
            </span>
            <span>
              <span className="text-gray-200 font-medium">{queue.task_count}</span>
              {' '}total
            </span>
          </div>

          <ChevronRightIcon
            size={16}
            className={`
              text-gray-600 transition-transform
              ${isSelected ? 'translate-x-0.5 text-accent' : 'group-hover:translate-x-0.5'}
            `}
          />
        </div>
      </div>
    </div>
  );
}
