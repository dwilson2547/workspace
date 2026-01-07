import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { useEffect, useState } from 'react';
import { TASK_META } from '@/types';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import styles from './QueueView.module.css';
import clsx from 'clsx';

export function QueueView() {
  const { queueId } = useParams();
  const { 
    queues, 
    tasks, 
    selectedQueueId, 
    selectQueue,
    fetchTasks,
    startQueue,
    pauseQueue,
  } = useAppStore();
  
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  // Select queue from URL param
  useEffect(() => {
    if (queueId && queueId !== selectedQueueId) {
      selectQueue(queueId);
    }
  }, [queueId, selectedQueueId, selectQueue]);

  // Fetch tasks when queue is selected
  useEffect(() => {
    if (selectedQueueId) {
      fetchTasks(selectedQueueId);
    }
  }, [selectedQueueId, fetchTasks]);

  const queue = queues.find(q => q.id === selectedQueueId);
  const queueTasks = selectedQueueId ? (tasks[selectedQueueId] || []) : [];

  if (!queue) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyContent}>
          <div className={styles.emptyIcon}>📋</div>
          <h2>No Queue Selected</h2>
          <p className="text-secondary">
            Select a queue from the sidebar or create a new one to get started.
          </p>
        </div>
      </div>
    );
  }

  const pendingCount = queueTasks.filter(t => t.status === 'pending').length;
  const runningCount = queueTasks.filter(t => t.status === 'running').length;
  const completedCount = queueTasks.filter(t => t.status === 'completed').length;
  const failedCount = queueTasks.filter(t => t.status === 'failed').length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{queue.name}</h1>
          <div className={styles.stats}>
            {pendingCount > 0 && (
              <span className={styles.stat}>{pendingCount} pending</span>
            )}
            {runningCount > 0 && (
              <span className={clsx(styles.stat, styles.statRunning)}>
                {runningCount} running
              </span>
            )}
            {completedCount > 0 && (
              <span className={clsx(styles.stat, styles.statCompleted)}>
                {completedCount} completed
              </span>
            )}
            {failedCount > 0 && (
              <span className={clsx(styles.stat, styles.statFailed)}>
                {failedCount} failed
              </span>
            )}
          </div>
        </div>
        <div className={styles.headerRight}>
          {queue.status === 'running' ? (
            <button 
              className="btn"
              onClick={() => pauseQueue(queue.id)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              Pause
            </button>
          ) : (
            <button 
              className="btn btn-primary"
              onClick={() => startQueue(queue.id)}
              disabled={queueTasks.length === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start
            </button>
          )}
          <button className="btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {queueTasks.length === 0 ? (
          <div className={styles.emptyTasks}>
            <p className="text-secondary">No tasks in queue</p>
            <button 
              className="btn btn-primary" 
              style={{ marginTop: 'var(--space-4)' }}
              onClick={() => setIsAddTaskOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Task
            </button>
          </div>
        ) : (
          <div className={styles.taskList}>
            {queueTasks.map(task => (
              <div key={task.id} className={styles.taskCard}>
                <div className={styles.taskHeader}>
                  <span className={styles.taskIcon}>
                    {TASK_META[task.type]?.icon || '📄'}
                  </span>
                  <span className={styles.taskType}>
                    {TASK_META[task.type]?.label || task.type}
                  </span>
                  <span className={clsx(
                    styles.taskStatus,
                    styles[`taskStatus${task.status.charAt(0).toUpperCase()}${task.status.slice(1)}`]
                  )}>
                    {task.status}
                  </span>
                </div>
                {task.status === 'running' && (
                  <div className={styles.taskProgress}>
                    <div className="progress">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${task.progress}%` }} 
                      />
                    </div>
                    <span className={styles.taskProgressText}>{task.progress}%</span>
                  </div>
                )}
                {task.error && (
                  <p className={styles.taskError}>{task.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Action Bar */}
      <footer className={styles.footer}>
        <button className="btn" onClick={() => setIsAddTaskOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Task
        </button>
        <div className={styles.footerRight}>
          <span className="text-tertiary text-mono" style={{ fontSize: 'var(--text-xs)' }}>
            Max Parallel: {queue.maxParallel}
          </span>
        </div>
      </footer>

      {/* Add Task Dialog */}
      <AddTaskDialog
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        queueId={queue.id}
        mode="queue"
      />
    </div>
  );
}
