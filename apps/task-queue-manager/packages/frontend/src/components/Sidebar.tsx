import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { QueueCard } from './QueueCard';
import { WorkflowCard } from './WorkflowCard';
import styles from './Sidebar.module.css';
import clsx from 'clsx';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    queues,
    workflows,
    selectedQueueId,
    selectedWorkflowId,
    selectQueue,
    selectWorkflow,
    createQueue,
  } = useAppStore();

  const handleQueueClick = (queueId: string) => {
    selectQueue(queueId);
    navigate(`/queues/${queueId}`);
  };

  const handleWorkflowClick = (workflowId: string) => {
    selectWorkflow(workflowId);
    navigate(`/workflows/${workflowId}`);
  };

  const handleNewQueue = async () => {
    const queue = await createQueue('New Queue');
    selectQueue(queue.id);
    navigate(`/queues/${queue.id}`);
  };

  const handleNewWorkflow = (type: 'file_pipeline' | 'task_sequence') => {
    // Navigate to create workflow view
    navigate(`/workflows/new?type=${type}`);
  };

  const isSettingsActive = location.pathname === '/settings';

  return (
    <aside className={styles.sidebar}>
      {/* App Title */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>⚡</span>
          Task Queue
        </h1>
      </div>

      {/* Scrollable Content */}
      <div className={styles.content}>
        {/* Queues Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>QUEUES</h2>
            <button
              className={clsx('btn', 'btn-ghost', 'btn-sm', styles.addButton)}
              onClick={handleNewQueue}
              title="Create new queue"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <div className={styles.list}>
            {queues.length === 0 ? (
              <p className={styles.emptyText}>No queues yet</p>
            ) : (
              queues.map(queue => (
                <QueueCard
                  key={queue.id}
                  queue={queue}
                  isSelected={selectedQueueId === queue.id}
                  onClick={() => handleQueueClick(queue.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Workflows Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>WORKFLOWS</h2>
            <div className={styles.dropdownWrapper}>
              <button
                className={clsx('btn', 'btn-ghost', 'btn-sm', styles.addButton)}
                title="Create new workflow"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div className={styles.dropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={() => handleNewWorkflow('file_pipeline')}
                >
                  <span className={styles.dropdownIcon}>🔵</span>
                  File Pipeline
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => handleNewWorkflow('task_sequence')}
                >
                  <span className={styles.dropdownIcon}>🟢</span>
                  Task Sequence
                </button>
              </div>
            </div>
          </div>
          <div className={styles.list}>
            {workflows.length === 0 ? (
              <p className={styles.emptyText}>No workflows yet</p>
            ) : (
              workflows.map(workflow => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  isSelected={selectedWorkflowId === workflow.id}
                  onClick={() => handleWorkflowClick(workflow.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* History Section (placeholder) */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>HISTORY</h2>
          </div>
          <p className={styles.emptyText}>Coming soon...</p>
        </section>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button
          className={clsx(styles.footerButton, isSettingsActive && styles.footerButtonActive)}
          onClick={() => navigate('/settings')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
