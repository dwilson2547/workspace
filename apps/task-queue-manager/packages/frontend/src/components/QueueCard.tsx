import { Queue } from '@/types';
import clsx from 'clsx';
import styles from './QueueCard.module.css';

interface QueueCardProps {
  queue: Queue;
  isSelected: boolean;
  onClick: () => void;
}

export function QueueCard({ queue, isSelected, onClick }: QueueCardProps) {
  const statusClass = `status-dot-${queue.status}`;

  return (
    <button
      className={clsx(styles.card, isSelected && styles.selected)}
      onClick={onClick}
    >
      <div className={styles.header}>
        <span className={styles.name}>{queue.name}</span>
        <span className={clsx('status-dot', statusClass)} title={queue.status} />
      </div>
      <div className={styles.meta}>
        <span className={styles.stat}>
          Max: {queue.maxParallel}
        </span>
        <span className={styles.status}>
          {queue.status.charAt(0).toUpperCase() + queue.status.slice(1)}
        </span>
      </div>
    </button>
  );
}
