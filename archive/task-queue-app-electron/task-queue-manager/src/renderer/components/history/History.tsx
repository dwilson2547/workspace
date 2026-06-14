import React, { useState } from 'react';
import { useHistory, useClearHistory } from '../../hooks/useApi';
import { 
  History as HistoryIcon, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Trash2,
  Copy,
  FileArchive,
  Archive,
  Film,
  FolderSync,
  Trash,
  Terminal
} from 'lucide-react';
import { TaskHistory, TaskType, TaskStatus } from '@shared/types';

export default function History() {
  const [limit, setLimit] = useState(50);
  const { data: history, isLoading, error } = useHistory(limit);
  const clearHistory = useClearHistory();

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
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 86400000) {
      // Today
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 172800000) {
      // Yesterday
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all history?')) {
      await clearHistory.mutateAsync();
    }
  };

  const stats = history ? {
    total: history.length,
    completed: history.filter(h => h.status === 'completed').length,
    failed: history.filter(h => h.status === 'failed').length,
    cancelled: history.filter(h => h.status === 'cancelled').length,
  } : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">History</h1>
          <p className="text-gray-400 mt-1">View past task executions</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-4 py-2 rounded-lg bg-surface-dark border border-surface-light text-gray-200"
          >
            <option value={25}>Last 25</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
          </select>
          <button
            onClick={handleClearHistory}
            disabled={clearHistory.isPending || !history?.length}
            className="
              flex items-center gap-2 px-4 py-2
              bg-red-500/20 hover:bg-red-500/30 text-red-400
              rounded-lg transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-surface-dark border border-surface-light rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <HistoryIcon className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-100">{stats.total}</p>
                <p className="text-sm text-gray-400">Total</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-dark border border-surface-light rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
                <p className="text-sm text-gray-400">Completed</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-dark border border-surface-light rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                <p className="text-sm text-gray-400">Failed</p>
              </div>
            </div>
          </div>
          
          <div className="bg-surface-dark border border-surface-light rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{stats.cancelled}</p>
                <p className="text-sm text-gray-400">Cancelled</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">Error loading history</p>
        </div>
      ) : history && history.length > 0 ? (
        <div className="bg-surface-dark border border-surface-light rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-light">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Task</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Queue</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-light">
              {history.map((entry) => (
                <HistoryRow 
                  key={entry.id} 
                  entry={entry}
                  getTaskTypeIcon={getTaskTypeIcon}
                  getStatusIcon={getStatusIcon}
                  formatDuration={formatDuration}
                  formatDate={formatDate}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <HistoryIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No history yet</p>
          <p className="text-sm text-gray-500 mt-1">Run some tasks to see execution history</p>
        </div>
      )}
    </div>
  );
}

interface HistoryRowProps {
  entry: TaskHistory;
  getTaskTypeIcon: (type: TaskType) => React.ReactNode;
  getStatusIcon: (status: TaskStatus) => React.ReactNode;
  formatDuration: (ms: number) => string;
  formatDate: (dateStr: string) => string;
}

function HistoryRow({ entry, getTaskTypeIcon, getStatusIcon, formatDuration, formatDate }: HistoryRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr 
        className="hover:bg-surface-light/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {getStatusIcon(entry.status)}
            <span className={`
              text-sm capitalize
              ${entry.status === 'completed' ? 'text-emerald-400' :
                entry.status === 'failed' ? 'text-red-400' : 'text-amber-400'}
            `}>
              {entry.status}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-gray-200">{entry.taskName}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-gray-400">{entry.queueName}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {getTaskTypeIcon(entry.config.type)}
            <span className="text-sm text-gray-400 capitalize">{entry.config.type}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-gray-400 font-mono text-sm">{formatDuration(entry.duration)}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-gray-500 text-sm">{formatDate(entry.completedAt)}</span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-surface-darker">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-1">Configuration</h4>
                <pre className="text-xs text-gray-400 bg-surface-dark p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(entry.config, null, 2)}
                </pre>
              </div>
              {entry.error && (
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-1">Error</h4>
                  <pre className="text-xs text-red-400/80 bg-red-500/10 p-3 rounded-lg overflow-x-auto">
                    {entry.error}
                  </pre>
                </div>
              )}
              <div className="flex gap-6 text-xs text-gray-500">
                <span>Started: {new Date(entry.startedAt).toLocaleString()}</span>
                <span>Completed: {new Date(entry.completedAt).toLocaleString()}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
