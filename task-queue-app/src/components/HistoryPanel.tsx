import type { ReactNode } from 'react';
import type { TaskHistoryInfo, HistoryStats } from '../types';
import { formatBytes, formatDuration, formatDate } from '../api';
import { TrashIcon, CheckIcon, XIcon, ClockIcon } from './Icons';

interface HistoryPanelProps {
  history: TaskHistoryInfo[];
  stats: HistoryStats | null;
  loading: boolean;
  onClear: () => void;
}

export function HistoryPanel({ history, stats, loading, onClear }: HistoryPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header with stats */}
      <div className="flex-shrink-0 border-b border-surface-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">History</h2>
          
          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all task history?')) {
                  onClear();
                }
              }}
              className="btn-ghost text-xs text-gray-500 hover:text-status-error"
            >
              <TrashIcon size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Total"
              value={stats.total_tasks}
              icon={<ClockIcon size={14} />}
            />
            <StatCard
              label="Completed"
              value={stats.completed_tasks}
              icon={<CheckIcon size={14} />}
              color="success"
            />
            <StatCard
              label="Failed"
              value={stats.failed_tasks}
              icon={<XIcon size={14} />}
              color="error"
            />
            <StatCard
              label="Processed"
              value={formatBytes(stats.total_bytes_processed)}
              isText
            />
          </div>
        )}
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center mb-4">
              <span className="text-2xl">📜</span>
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-1">No history yet</h3>
            <p className="text-sm text-gray-500">
              Completed and failed tasks will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-700">
            {history.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Individual history item
function HistoryItem({ item }: { item: TaskHistoryInfo }) {
  const isSuccess = item.status === 'completed';
  const config = item.config as any;

  // Get summary based on task type
  const getSummary = () => {
    switch (item.task_type) {
      case 'copy':
        return config.destination || config.source;
      case 'zip':
      case 'tar':
        return config.output;
      case 'transcode':
        return config.output;
      default:
        return 'Task completed';
    }
  };

  return (
    <div className="px-4 py-3 hover:bg-surface-800/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div
          className={`
            w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
            ${isSuccess ? 'bg-status-success/20 text-status-success' : 'bg-status-error/20 text-status-error'}
          `}
        >
          {isSuccess ? <CheckIcon size={12} /> : <XIcon size={12} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-gray-400 uppercase">
              {item.task_type}
            </span>
            <span className="text-xs text-gray-600">•</span>
            <span className="text-xs text-gray-500">{item.queue_name}</span>
          </div>

          <p className="text-sm text-gray-300 truncate font-mono">
            {getSummary()}
          </p>

          {/* Error message */}
          {item.error_message && (
            <p className="text-xs text-status-error mt-1 truncate">
              {item.error_message}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
            {item.completed_at && (
              <span>{formatDate(item.completed_at)}</span>
            )}
            {item.duration_ms != null && item.duration_ms > 0 && (
              <span>{formatDuration(item.duration_ms)}</span>
            )}
            {item.bytes_processed != null && item.bytes_processed > 0 && (
              <span>{formatBytes(item.bytes_processed)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  icon,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  color?: 'success' | 'error';
  isText?: boolean;
}) {
  const colorClass = color === 'success'
    ? 'text-status-success'
    : color === 'error'
    ? 'text-status-error'
    : 'text-gray-300';

  return (
    <div className="bg-surface-700/50 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-lg font-semibold ${colorClass}`}>
        {isText ? value : value.toLocaleString()}
      </div>
    </div>
  );
}
