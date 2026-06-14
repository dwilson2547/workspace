import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { QueueCard } from './components/QueueCard';
import { TaskList, NoQueueSelected } from './components/TaskList';
import { HistoryPanel } from './components/HistoryPanel';
import { CreateQueueModal } from './components/modals/CreateQueueModal';
import { PlusIcon, HistoryIcon, QueueIcon, RefreshIcon } from './components/Icons';
import { useQueues, useTasks, useTaskProgress, useHistory } from './hooks/useQueues';

type View = 'queues' | 'history';

export default function App() {
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<View>('queues');
  const lastRecoveryMsRef = useRef<number>(0);

  // Hooks
  const {
    queues,
    loading: queuesLoading,
    refresh: refreshQueues,
    createQueue,
    deleteQueue,
    resumeQueue,
    pauseQueue,
  } = useQueues();

  const {
    tasks,
    loading: tasksLoading,
    refresh: refreshTasks,
    addTask,
    deleteTask,
  } = useTasks(selectedQueueId);

  const { progress } = useTaskProgress();

  const {
    history,
    stats,
    loading: historyLoading,
    refresh: refreshHistory,
    clearHistory,
  } = useHistory();

  // Get selected queue
  const selectedQueue = queues.find((q) => q.id === selectedQueueId);

  // Recovery function to refresh all data after sleep/monitor off
  const recoverFromSleep = useCallback(() => {
    const now = Date.now();
    // Focus/visibility can fire multiple times in quick succession (and we also
    // emit a Rust-side "window-focused" event). Debounce to avoid IPC storms.
    if (now - lastRecoveryMsRef.current < 1000) return;
    lastRecoveryMsRef.current = now;

    console.log('Recovering from sleep/focus loss...');
    refreshQueues();
    refreshTasks();
    refreshHistory();
  }, [refreshQueues, refreshTasks, refreshHistory]);

  // Handle window focus recovery (for WebView2 white screen issue)
  useEffect(() => {
    // Browser visibility change (tab/window hidden/shown)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Document became visible');
        recoverFromSleep();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for Tauri's custom window-focused event from Rust backend
    const unlistenPromise = listen('window-focused', () => {
      console.log('Received window-focused event from Tauri');
      recoverFromSleep();
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [recoverFromSleep]);



  // Auto-select first queue if none selected
  useEffect(() => {
    if (!selectedQueueId && queues.length > 0) {
      setSelectedQueueId(queues[0].id);
    }
  }, [queues, selectedQueueId]);

  // Clear selection if queue is deleted
  useEffect(() => {
    if (selectedQueueId && !queues.find((q) => q.id === selectedQueueId)) {
      setSelectedQueueId(queues[0]?.id || null);
    }
  }, [queues, selectedQueueId]);

  const handleCreateQueue = async (name: string) => {
    const queue = await createQueue(name);
    setSelectedQueueId(queue.id);
    setSidebarView('queues');
  };

  const handleDeleteQueue = async (id: string) => {
    await deleteQueue(id);
    if (selectedQueueId === id) {
      setSelectedQueueId(null);
    }
  };

  return (
    <div className="h-screen flex bg-surface-950 bg-grid-pattern">
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 border-r border-surface-700 flex flex-col bg-surface-900/50 backdrop-blur-sm">
        {/* Sidebar header */}
        <div className="flex-shrink-0 p-4 border-b border-surface-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <span className="text-accent">⚡</span>
              Task Queue
            </h1>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn-primary py-1.5 px-3 text-sm"
            >
              <PlusIcon size={16} />
              New
            </button>
          </div>

          {/* View tabs */}
          <div className="flex bg-surface-800 rounded-lg p-1">
            <button
              onClick={() => setSidebarView('queues')}
              className={`
                flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-colors
                ${sidebarView === 'queues' ? 'bg-surface-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'}
              `}
            >
              <QueueIcon size={16} />
              Queues
            </button>
            <button
              onClick={() => setSidebarView('history')}
              className={`
                flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-colors
                ${sidebarView === 'history' ? 'bg-surface-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'}
              `}
            >
              <HistoryIcon size={16} />
              History
            </button>
          </div>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-hidden">
          {sidebarView === 'queues' ? (
            <div className="h-full flex flex-col">
              {/* Queue list header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700/50">
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  {queues.length} Queue{queues.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={refreshQueues}
                  className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-surface-700 transition-colors"
                  title="Refresh"
                >
                  <RefreshIcon size={14} />
                </button>
              </div>

              {/* Queue list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {queuesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : queues.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-surface-700 flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl">📭</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">No queues yet</p>
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="btn-primary text-sm py-1.5"
                    >
                      <PlusIcon size={14} />
                      Create Queue
                    </button>
                  </div>
                ) : (
                  queues.map((queue) => (
                    <QueueCard
                      key={queue.id}
                      queue={queue}
                      isSelected={queue.id === selectedQueueId}
                      progress={queue.current_task ? progress.get(queue.current_task.id) : undefined}
                      onSelect={() => setSelectedQueueId(queue.id)}
                      onResume={() => resumeQueue(queue.id)}
                      onPause={() => pauseQueue(queue.id)}
                      onDelete={() => handleDeleteQueue(queue.id)}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <HistoryPanel
              history={history}
              stats={stats}
              loading={historyLoading}
              onClear={clearHistory}
            />
          )}
        </div>

        {/* Footer stats */}
        {stats && sidebarView === 'queues' && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-surface-700 bg-surface-800/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{stats.completed_tasks} completed</span>
              <span className="text-gray-600">•</span>
              <span>{stats.failed_tasks} failed</span>
              <span className="text-gray-600">•</span>
              <span>{formatBytes(stats.total_bytes_processed)}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface-900/30">
        {selectedQueue ? (
          <TaskList
            queue={selectedQueue}
            tasks={tasks}
            loading={tasksLoading}
            progress={progress}
            onRefresh={refreshTasks}
            onAddTask={async (taskType, config) => {
              await addTask(taskType, config);
            }}
            onDeleteTask={deleteTask}
            onResume={() => resumeQueue(selectedQueue.id)}
            onPause={() => pauseQueue(selectedQueue.id)}
          />
        ) : (
          <NoQueueSelected />
        )}
      </main>

      {/* Create queue modal */}
      <CreateQueueModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateQueue}
      />
    </div>
  );
}

// Utility function (also in api.ts but needed here)
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
