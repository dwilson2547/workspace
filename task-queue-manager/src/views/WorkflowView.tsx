import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { useEffect } from 'react';
import { TASK_META } from '@/types';
import styles from './WorkflowView.module.css';
import clsx from 'clsx';

export function WorkflowView() {
  const { workflowId } = useParams();
  const { 
    workflows, 
    selectedWorkflowId, 
    selectWorkflow,
    startWorkflow,
    pauseWorkflow,
  } = useAppStore();

  // Select workflow from URL param
  useEffect(() => {
    if (workflowId && workflowId !== selectedWorkflowId) {
      selectWorkflow(workflowId);
    }
  }, [workflowId, selectedWorkflowId, selectWorkflow]);

  const workflow = workflows.find(w => w.id === selectedWorkflowId);

  if (!workflow) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyContent}>
          <div className={styles.emptyIcon}>⚡</div>
          <h2>No Workflow Selected</h2>
          <p className="text-secondary">
            Select a workflow from the sidebar or create a new one to get started.
          </p>
        </div>
      </div>
    );
  }

  const typeIcon = workflow.type === 'file_pipeline' ? '🔵' : '🟢';
  const typeLabel = workflow.type === 'file_pipeline' ? 'File Pipeline' : 'Task Sequence';

  const triggerConfig = {
    manual: { label: 'Manual', icon: '👆' },
    directory: { label: 'Directory', icon: '📁' },
    watch: { label: 'Watch', icon: '👁️' },
  }[workflow.trigger.type];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <span className={styles.typeIcon}>{typeIcon}</span>
            <h1 className={styles.title}>{workflow.name}</h1>
          </div>
          <div className={styles.meta}>
            <span className={styles.metaItem}>{typeLabel}</span>
            <span className={styles.metaSeparator}>•</span>
            <span className={styles.metaItem}>
              {triggerConfig.icon} {triggerConfig.label}
            </span>
            {workflow.trigger.path && (
              <>
                <span className={styles.metaSeparator}>•</span>
                <span className={clsx(styles.metaItem, 'text-mono')}>
                  {workflow.trigger.path}
                </span>
              </>
            )}
          </div>
        </div>
        <div className={styles.headerRight}>
          {workflow.status === 'running' ? (
            <button 
              className="btn"
              onClick={() => pauseWorkflow(workflow.id)}
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
              onClick={() => startWorkflow(workflow.id)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Start
            </button>
          )}
          <button className="btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Edit
          </button>
          <button className="btn btn-ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className={styles.content}>
        <div className={styles.columns}>
          {/* Pipeline Column */}
          <div className={styles.column}>
            <h2 className={styles.columnTitle}>Pipeline</h2>
            <div className={styles.pipeline}>
              {/* Trigger Card */}
              <div className={styles.pipelineCard}>
                <div className={styles.pipelineCardHeader}>
                  <span className={styles.pipelineCardIcon}>{triggerConfig.icon}</span>
                  <span className={styles.pipelineCardTitle}>Trigger</span>
                </div>
                <div className={styles.pipelineCardContent}>
                  <p>{triggerConfig.label}</p>
                  {workflow.trigger.path && (
                    <p className="text-mono text-tertiary" style={{ fontSize: 'var(--text-xs)' }}>
                      {workflow.trigger.path}
                    </p>
                  )}
                  {workflow.trigger.filePattern && (
                    <p className="text-tertiary" style={{ fontSize: 'var(--text-xs)' }}>
                      Pattern: {workflow.trigger.filePattern}
                    </p>
                  )}
                </div>
              </div>

              {/* Connection Arrow */}
              {workflow.tasks.length > 0 && (
                <div className={styles.pipelineArrow}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="2">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </div>
              )}

              {/* Task Cards */}
              {workflow.tasks.length === 0 ? (
                <div className={styles.emptyPipeline}>
                  <p className="text-tertiary">No tasks in pipeline</p>
                  <button className="btn btn-sm" style={{ marginTop: 'var(--space-2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add Task
                  </button>
                </div>
              ) : (
                workflow.tasks.map((task, index) => (
                  <div key={task.id}>
                    <div className={styles.pipelineCard}>
                      <div className={styles.pipelineCardHeader}>
                        <span className={styles.pipelineNumber}>{index + 1}</span>
                        <span className={styles.pipelineCardIcon}>
                          {TASK_META[task.type]?.icon || '📄'}
                        </span>
                        <span className={styles.pipelineCardTitle}>
                          {TASK_META[task.type]?.label || task.type}
                        </span>
                      </div>
                      <div className={styles.pipelineCardContent}>
                        <p className="text-tertiary" style={{ fontSize: 'var(--text-xs)' }}>
                          On Error: {task.onError.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    {index < workflow.tasks.length - 1 && (
                      <div className={styles.pipelineArrow}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="2">
                          <path d="M12 5v14M5 12l7 7 7-7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Add Task Button */}
              {workflow.tasks.length > 0 && (
                <>
                  <div className={styles.pipelineArrow}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </div>
                  <button className={clsx(styles.pipelineCard, styles.addTaskCard)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>Add Task</span>
                  </button>
                </>
              )}

              {/* Output Card */}
              <div className={styles.pipelineArrow}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </div>
              <div className={styles.pipelineCard}>
                <div className={styles.pipelineCardHeader}>
                  <span className={styles.pipelineCardIcon}>📤</span>
                  <span className={styles.pipelineCardTitle}>Output</span>
                </div>
                <div className={styles.pipelineCardContent}>
                  <p className="text-mono text-tertiary" style={{ fontSize: 'var(--text-xs)' }}>
                    {workflow.output.directory}
                  </p>
                  <p className="text-tertiary" style={{ fontSize: 'var(--text-xs)' }}>
                    {workflow.output.nameTemplate}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* File Queue Column */}
          <div className={styles.column}>
            <h2 className={styles.columnTitle}>File Queue</h2>
            <div className={styles.fileQueue}>
              <div className={styles.emptyQueue}>
                <p className="text-tertiary">No files in queue</p>
                <p className="text-tertiary" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                  {workflow.trigger.type === 'watch' 
                    ? 'Files will appear here when detected in the watch folder'
                    : 'Add files manually or configure a trigger'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
