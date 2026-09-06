import { useState } from 'react';
import type { QueueInfo, TaskInfo, TaskProgress } from '../types';
import { TaskItem, TasksEmptyState } from './TaskItem';
import { AddTaskModal } from './modals/AddTaskModal';
import {
  PlayIcon,
  PauseIcon,
  RefreshIcon,
  CopyIcon,
  ArchiveIcon,
  VideoIcon,
} from './Icons';

interface TaskListProps {
  queue: QueueInfo;
  tasks: TaskInfo[];
  loading: boolean;
  progress: Map<string, TaskProgress>;
  onRefresh: () => void;
  onAddTask: (taskType: string, config: any) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
  onResume: () => void;
  onPause: () => void;
}

export function TaskList({
  queue,
  tasks,
  loading,
  progress,
  onRefresh,
  onAddTask,
  onDeleteTask,
  onResume,
  onPause,
}: TaskListProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<string>('copy');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRunning = queue.status === 'running';
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const runningTask = tasks.find((t) => t.status === 'running');

  const handleAddTask = async (taskType: string, config: any) => {
    setIsSubmitting(true);
    try {
      await onAddTask(taskType, config);
      setAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddModal = (type: string) => {
    setAddModalType(type);
    setAddModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-700 bg-surface-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className={`
                  w-3 h-3 rounded-full
                  ${isRunning ? 'bg-status-running animate-pulse' : 'bg-status-idle'}
                `}
              />
              <h2 className="text-lg font-semibold text-gray-100">{queue.name}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onRefresh}
                className="btn-ghost p-2"
                title="Refresh"
              >
                <RefreshIcon size={16} />
              </button>

              {isRunning ? (
                <button onClick={onPause} className="btn-secondary">
                  <PauseIcon size={16} />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={onResume}
                  disabled={pendingTasks.length === 0}
                  className="btn-success"
                >
                  <PlayIcon size={16} />
                  <span>Resume</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick add buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">Add task:</span>
            
            <button
              onClick={() => openAddModal('copy')}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              <CopyIcon size={14} />
              <span>Copy</span>
            </button>
            
            <button
              onClick={() => openAddModal('zip')}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              <ArchiveIcon size={14} />
              <span>Zip</span>
            </button>
            
            <button
              onClick={() => openAddModal('tar')}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              <ArchiveIcon size={14} />
              <span>Tar</span>
            </button>
            
            <button
              onClick={() => openAddModal('transcode')}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              <VideoIcon size={14} />
              <span>Transcode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <TasksEmptyState />
        ) : (
          <div className="space-y-2">
            {/* Running task first */}
            {runningTask && (
              <TaskItem
                key={runningTask.id}
                task={runningTask}
                progress={progress.get(runningTask.id)}
                onDelete={() => {}}
              />
            )}

            {/* Pending tasks */}
            {pendingTasks.length > 0 && (
              <>
                {runningTask && (
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex-1 border-t border-surface-700" />
                    <span className="text-xs text-gray-500 px-2">
                      {pendingTasks.length} pending
                    </span>
                    <div className="flex-1 border-t border-surface-700" />
                  </div>
                )}
                
                {pendingTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    progress={progress.get(task.id)}
                    onDelete={() => onDeleteTask(task.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add task modal */}
      <AddTaskModal
        isOpen={addModalOpen}
        taskType={addModalType}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleAddTask}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

// Empty state when no queue is selected
export function NoQueueSelected() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 rounded-2xl bg-surface-700 flex items-center justify-center mb-6">
        <span className="text-4xl">📂</span>
      </div>
      <h3 className="text-xl font-semibold text-gray-200 mb-2">
        Select a queue
      </h3>
      <p className="text-gray-500 max-w-sm">
        Choose a queue from the sidebar to view and manage its tasks, or create a new queue to get started.
      </p>
    </div>
  );
}
