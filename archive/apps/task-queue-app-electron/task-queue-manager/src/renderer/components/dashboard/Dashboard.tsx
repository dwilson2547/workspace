import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { useStartQueue, usePauseQueue, useDeleteQueue, useResetWorkflow } from '../../hooks/useApi';
import { 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw,
  ListTodo,
  Workflow,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Queue, QueueStatus } from '@shared/types';

interface DashboardProps {
  onCreateQueue: () => void;
}

export default function Dashboard({ onCreateQueue }: DashboardProps) {
  const { queues, setSelectedQueueId } = useAppStore();
  const startQueue = useStartQueue();
  const pauseQueue = usePauseQueue();
  const deleteQueue = useDeleteQueue();
  const resetWorkflow = useResetWorkflow();

  const handleStart = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await startQueue.mutateAsync(id);
  };

  const handlePause = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await pauseQueue.mutateAsync(id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      await deleteQueue.mutateAsync(id);
    }
  };

  const handleReset = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await resetWorkflow.mutateAsync(id);
  };

  const getStatusIcon = (status: QueueStatus) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-emerald-400" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-amber-400" />;
      case 'idle':
        return <CheckCircle2 className="w-4 h-4 text-gray-400" />;
    }
  };

  const taskQueues = queues.filter(q => q.type === 'queue');
  const workflows = queues.filter(q => q.type === 'workflow');

  const QueueCard = ({ queue }: { queue: Queue }) => (
    <div
      onClick={() => setSelectedQueueId(queue.id)}
      className="
        bg-surface-dark border border-surface-light rounded-xl p-5
        hover:border-cyan-500/50 hover:bg-surface-light/50
        transition-all duration-200 cursor-pointer
        group
      "
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {queue.type === 'workflow' ? (
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Workflow className="w-5 h-5 text-purple-400" />
            </div>
          ) : (
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <ListTodo className="w-5 h-5 text-emerald-400" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-100 group-hover:text-cyan-400 transition-colors">
              {queue.name}
            </h3>
            <span className="text-xs text-gray-500 capitalize">
              {queue.type}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          {getStatusIcon(queue.status)}
          <span className={`
            text-xs font-medium capitalize
            ${queue.status === 'running' ? 'text-emerald-400' :
              queue.status === 'paused' ? 'text-amber-400' : 'text-gray-500'}
          `}>
            {queue.status}
          </span>
        </div>
      </div>

      {queue.description && (
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
          {queue.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-surface-light">
        <div className="text-xs text-gray-500">
          Updated {new Date(queue.updatedAt).toLocaleDateString()}
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {queue.status === 'paused' || queue.status === 'idle' ? (
            <button
              onClick={(e) => handleStart(e, queue.id)}
              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
              title="Start queue"
              disabled={startQueue.isPending}
            >
              <Play className="w-4 h-4 text-emerald-400" />
            </button>
          ) : (
            <button
              onClick={(e) => handlePause(e, queue.id)}
              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
              title="Pause queue"
              disabled={pauseQueue.isPending}
            >
              <Pause className="w-4 h-4 text-amber-400" />
            </button>
          )}
          
          {queue.type === 'workflow' && (
            <button
              onClick={(e) => handleReset(e, queue.id)}
              className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 transition-colors"
              title="Reset workflow"
              disabled={resetWorkflow.isPending}
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </button>
          )}
          
          <button
            onClick={(e) => handleDelete(e, queue.id, queue.name)}
            className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
            title="Delete queue"
            disabled={deleteQueue.isPending}
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-gray-400 mt-1">Manage your task queues and workflows</p>
        </div>
        <button
          onClick={onCreateQueue}
          className="
            flex items-center gap-2 px-4 py-2.5
            bg-cyan-500 hover:bg-cyan-400
            text-surface-dark font-semibold
            rounded-lg transition-colors
          "
        >
          <Plus className="w-5 h-5" />
          New Queue
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-dark border border-surface-light rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Play className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-100">
                {queues.filter(q => q.status === 'running').length}
              </p>
              <p className="text-sm text-gray-400">Running</p>
            </div>
          </div>
        </div>
        
        <div className="bg-surface-dark border border-surface-light rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Pause className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-100">
                {queues.filter(q => q.status === 'paused').length}
              </p>
              <p className="text-sm text-gray-400">Paused</p>
            </div>
          </div>
        </div>
        
        <div className="bg-surface-dark border border-surface-light rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-100">
                {queues.filter(q => q.status === 'idle').length}
              </p>
              <p className="text-sm text-gray-400">Idle</p>
            </div>
          </div>
        </div>
      </div>

      {/* Task Queues */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ListTodo className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-gray-100">Task Queues</h2>
          <span className="text-sm text-gray-500">({taskQueues.length})</span>
        </div>
        
        {taskQueues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {taskQueues.map((queue) => (
              <QueueCard key={queue.id} queue={queue} />
            ))}
          </div>
        ) : (
          <div className="bg-surface-dark border border-dashed border-surface-light rounded-xl p-8 text-center">
            <ListTodo className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No task queues yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Create a queue to run temporary tasks that are removed after completion
            </p>
          </div>
        )}
      </section>

      {/* Workflows */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-gray-100">Workflows</h2>
          <span className="text-sm text-gray-500">({workflows.length})</span>
        </div>
        
        {workflows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((queue) => (
              <QueueCard key={queue.id} queue={queue} />
            ))}
          </div>
        ) : (
          <div className="bg-surface-dark border border-dashed border-surface-light rounded-xl p-8 text-center">
            <Workflow className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No workflows yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Create a workflow to run persistent, repeatable task sequences
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
