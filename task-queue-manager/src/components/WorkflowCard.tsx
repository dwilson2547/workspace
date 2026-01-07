import { Workflow } from '@/types';
import clsx from 'clsx';
import styles from './WorkflowCard.module.css';

interface WorkflowCardProps {
  workflow: Workflow;
  isSelected: boolean;
  onClick: () => void;
}

export function WorkflowCard({ workflow, isSelected, onClick }: WorkflowCardProps) {
  const typeIcon = workflow.type === 'file_pipeline' ? '🔵' : '🟢';
  const typeLabel = workflow.type === 'file_pipeline' ? 'Pipeline' : 'Sequence';
  const statusClass = `status-dot-${workflow.status}`;

  const triggerLabel = {
    manual: 'Manual',
    directory: 'Directory',
    watch: 'Watch',
  }[workflow.trigger.type];

  return (
    <button
      className={clsx(styles.card, isSelected && styles.selected)}
      onClick={onClick}
    >
      <div className={styles.header}>
        <span className={styles.icon}>{typeIcon}</span>
        <span className={styles.name}>{workflow.name}</span>
        <span className={clsx('status-dot', statusClass)} title={workflow.status} />
      </div>
      <div className={styles.meta}>
        <span className={styles.type}>{typeLabel}</span>
        <span className={styles.trigger}>{triggerLabel}</span>
      </div>
    </button>
  );
}
