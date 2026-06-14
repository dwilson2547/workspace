import type { Queue, Workflow } from '@shared/types';

interface SidebarProps {
  queues: Queue[];
  workflows: Workflow[];
  selectedQueueId: string | null;
  selectedWorkflowId: string | null;
  isCreatingQueue: boolean;
  queueName: string;
  onQueueNameChange: (value: string) => void;
  onCreateQueue: () => void;
  onToggleCreateQueue: () => void;
  onCancelCreateQueue: () => void;
  isCreatingWorkflow: boolean;
  workflowName: string;
  onWorkflowNameChange: (value: string) => void;
  onCreateWorkflow: () => void;
  onToggleCreateWorkflow: () => void;
  onCancelCreateWorkflow: () => void;
  onSelectQueue: (queueId: string) => void;
  onSelectWorkflow: (workflowId: string) => void;
}

export default function Sidebar({
  queues,
  workflows,
  selectedQueueId,
  selectedWorkflowId,
  isCreatingQueue,
  queueName,
  onQueueNameChange,
  onCreateQueue,
  onToggleCreateQueue,
  onCancelCreateQueue,
  isCreatingWorkflow,
  workflowName,
  onWorkflowNameChange,
  onCreateWorkflow,
  onToggleCreateWorkflow,
  onCancelCreateWorkflow,
  onSelectQueue,
  onSelectWorkflow
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Task Manager</h1>
        <button onClick={onToggleCreateQueue}>+ New Queue</button>
      </div>
      {isCreatingQueue && (
        <div className="panel">
          <label>
            Queue name
            <input
              value={queueName}
              onChange={(event) => onQueueNameChange(event.target.value)}
              placeholder="e.g. Daily backups"
            />
          </label>
          <div className="actions">
            <button onClick={onCreateQueue}>Create</button>
            <button className="secondary" onClick={onCancelCreateQueue}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="sidebar-section">
        <h2>Queues</h2>
        <ul>
          {queues.map((queue) => (
            <li
              key={queue.id}
              className={queue.id === selectedQueueId ? 'active' : ''}
              onClick={() => onSelectQueue(queue.id)}
            >
              <span>{queue.name}</span>
              <small>{queue.status}</small>
            </li>
          ))}
        </ul>
      </div>
      <div className="sidebar-section">
        <div className="section-header">
          <h2>Workflows</h2>
          <button className="secondary" onClick={onToggleCreateWorkflow}>
            + New
          </button>
        </div>
        {isCreatingWorkflow && (
          <div className="panel">
            <label>
              Workflow name
              <input
                value={workflowName}
                onChange={(event) => onWorkflowNameChange(event.target.value)}
                placeholder="e.g. Video pipeline"
              />
            </label>
            <div className="actions">
              <button onClick={onCreateWorkflow}>Create</button>
              <button className="secondary" onClick={onCancelCreateWorkflow}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <ul>
          {workflows.map((workflow) => (
            <li
              key={workflow.id}
              className={workflow.id === selectedWorkflowId ? 'active' : ''}
              onClick={() => onSelectWorkflow(workflow.id)}
            >
              <span>{workflow.name}</span>
              <small>{workflow.status}</small>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
