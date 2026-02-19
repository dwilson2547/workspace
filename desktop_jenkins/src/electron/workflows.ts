import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  TaskType,
  DirectoryWatcherConfig,
  Workflow,
  WorkflowExecutionMode,
  WorkflowFile,
  WorkflowFileHistory,
  WorkflowTask,
  WorkflowTaskConfig,
  WorkflowTaskStatus
} from '../src/shared/types';
import { getDatabase } from './db';

const defaultWatcherConfig: DirectoryWatcherConfig = {
  enabled: false,
  watchPath: '',
  recursive: false,
  filters: {
    extensions: undefined,
    filenamePattern: undefined,
    ignoreHidden: true,
    minSize: undefined
  },
  ignoreExisting: true,
  stabilityDelay: 3000,
  pollInterval: undefined
};

const normalizeWatcherConfig = (value?: string | null): DirectoryWatcherConfig => {
  if (!value) {
    return { ...defaultWatcherConfig };
  }
  try {
    const parsed = JSON.parse(value) as DirectoryWatcherConfig;
    return {
      ...defaultWatcherConfig,
      ...parsed,
      filters: {
        ...defaultWatcherConfig.filters,
        ...(parsed.filters ?? {})
      }
    };
  } catch {
    return { ...defaultWatcherConfig };
  }
};

const serializeWorkflowTask = (task: WorkflowTask) => ({
  ...task,
  config: JSON.stringify(task.config)
});

const deserializeWorkflowTask = (row: any): WorkflowTask => ({
  id: row.id,
  type: row.type as TaskType,
  name: row.name,
  config: JSON.parse(row.config) as WorkflowTaskConfig,
  order: row.task_order ?? 0,
  createdAt: row.created_at
});

const deserializeWorkflowFile = (row: any): WorkflowFile => ({
  id: row.id,
  workflowId: row.workflow_id,
  filePath: row.file_path,
  status: row.status,
  currentTaskIndex: row.current_task_index ?? 0,
  error: row.error ?? undefined,
  addedAt: row.added_at,
  startedAt: row.started_at ?? undefined,
  completedAt: row.completed_at ?? undefined
});

const deserializeWorkflowHistory = (row: any): WorkflowFileHistory => ({
  id: row.id,
  workflowId: row.workflow_id,
  filePath: row.file_path,
  status: row.status,
  startedAt: row.started_at ?? undefined,
  completedAt: row.completed_at ?? undefined,
  error: row.error ?? undefined,
  taskStatuses: JSON.parse(row.task_statuses) as WorkflowTaskStatus[]
});

export const listWorkflows = (): Workflow[] => {
  const db = getDatabase();
  const workflowRows = db.prepare('SELECT * FROM workflows ORDER BY created_at ASC').all();

  return workflowRows.map((workflowRow: any) => {
    const taskRows = db
      .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
      .all(workflowRow.id);
    const fileRows = db
      .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
      .all(workflowRow.id);
    const historyRows = db
      .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
      .all(workflowRow.id);

    return {
      id: workflowRow.id,
      name: workflowRow.name,
      description: workflowRow.description ?? undefined,
      tasks: taskRows.map(deserializeWorkflowTask),
      executionMode: workflowRow.execution_mode as WorkflowExecutionMode,
      maxParallel: workflowRow.max_parallel ?? undefined,
      fileQueue: fileRows.map(deserializeWorkflowFile),
      history: historyRows.map(deserializeWorkflowHistory),
      status: workflowRow.status,
      watcherConfig: normalizeWatcherConfig(workflowRow.watcher_config),
      createdAt: workflowRow.created_at,
      updatedAt: workflowRow.updated_at
    } as Workflow;
  });
};

export const createWorkflow = (name: string): Workflow => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: randomUUID(),
    name,
    description: undefined,
    tasks: [],
    executionMode: 'sequential',
    maxParallel: 2,
    fileQueue: [],
    history: [],
    status: 'idle',
    watcherConfig: { ...defaultWatcherConfig },
    createdAt: now,
    updatedAt: now
  };

  db.prepare(
    'INSERT INTO workflows (id, name, description, execution_mode, max_parallel, status, watcher_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    workflow.id,
    workflow.name,
    workflow.description ?? null,
    workflow.executionMode,
    workflow.maxParallel ?? null,
    workflow.status,
    JSON.stringify(workflow.watcherConfig ?? defaultWatcherConfig),
    workflow.createdAt,
    workflow.updatedAt
  );

  return workflow;
};

export const addWorkflowTask = (
  workflowId: string,
  taskData: { name: string; type: TaskType; config: WorkflowTaskConfig }
): WorkflowTask => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const task: WorkflowTask = {
    id: randomUUID(),
    name: taskData.name,
    type: taskData.type,
    config: taskData.config,
    order: 0,
    createdAt: now
  };

  const nextOrder =
    (db
      .prepare('SELECT COALESCE(MAX(task_order), -1) as maxOrder FROM tasks WHERE workflow_id = ?')
      .get(workflowId) as { maxOrder: number }).maxOrder + 1;
  task.order = nextOrder;

  const serialized = serializeWorkflowTask(task);

  db.prepare(
    `INSERT INTO tasks (id, workflow_id, type, name, config, status, progress, error, task_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    serialized.id,
    workflowId,
    serialized.type,
    serialized.name,
    serialized.config,
    'pending',
    null,
    null,
    serialized.order,
    serialized.createdAt
  );

  db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(now, workflowId);

  return task;
};

export const removeWorkflowTask = (workflowId: string, taskId: string) => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND workflow_id = ?').run(taskId, workflowId);
  if (result.changes > 0) {
    db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
  }
  return result.changes > 0;
};

export const addWorkflowFiles = (workflowId: string, filePaths: string[]): WorkflowFile[] => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const created: WorkflowFile[] = [];

  const insert = db.prepare(
    'INSERT INTO workflow_files (id, workflow_id, file_path, status, current_task_index, error, added_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const exists = db.prepare(
    'SELECT 1 FROM workflow_files WHERE workflow_id = ? AND file_path = ? LIMIT 1'
  );

  filePaths.forEach((filePath) => {
    if (!filePath) {
      return;
    }
    const existing = exists.get(workflowId, filePath) as { 1: number } | undefined;
    if (existing) {
      return;
    }
    const file: WorkflowFile = {
      id: randomUUID(),
      workflowId,
      filePath,
      status: 'pending',
      currentTaskIndex: 0,
      addedAt: now
    };
    insert.run(file.id, workflowId, file.filePath, file.status, file.currentTaskIndex, null, file.addedAt);
    created.push(file);
  });

  if (created.length > 0) {
    db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(now, workflowId);
  }

  return created;
};

export const addWorkflowFolder = async (workflowId: string, folderPath: string): Promise<WorkflowFile[]> => {
  const entries = await (await import('node:fs/promises')).readdir(folderPath, { withFileTypes: true });
  const filePaths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folderPath, entry.name));
  return addWorkflowFiles(workflowId, filePaths);
};

export const updateWorkflowSettings = (
  workflowId: string,
  settings: Pick<Workflow, 'executionMode' | 'maxParallel'>
): Workflow => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE workflows SET execution_mode = ?, max_parallel = ?, updated_at = ? WHERE id = ?').run(
    settings.executionMode,
    settings.maxParallel ?? null,
    now,
    workflowId
  );

  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId) as any;
  const tasks = db
    .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
    .all(workflowId) as any[];
  const files = db
    .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
    .all(workflowId) as any[];
  const historyRows = db
    .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
    .all(workflowId) as any[];

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    tasks: tasks.map(deserializeWorkflowTask),
    executionMode: row.execution_mode,
    maxParallel: row.max_parallel ?? undefined,
    fileQueue: files.map(deserializeWorkflowFile),
    history: historyRows.map(deserializeWorkflowHistory),
    status: row.status,
    watcherConfig: normalizeWatcherConfig(row.watcher_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } as Workflow;
};

export const updateWorkflowWatcherConfig = (
  workflowId: string,
  config: DirectoryWatcherConfig
): Workflow => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE workflows SET watcher_config = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(config),
    now,
    workflowId
  );

  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId) as any;
  const tasks = db
    .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
    .all(workflowId) as any[];
  const files = db
    .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
    .all(workflowId) as any[];
  const historyRows = db
    .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
    .all(workflowId) as any[];

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    tasks: tasks.map(deserializeWorkflowTask),
    executionMode: row.execution_mode,
    maxParallel: row.max_parallel ?? undefined,
    fileQueue: files.map(deserializeWorkflowFile),
    history: historyRows.map(deserializeWorkflowHistory),
    status: row.status,
    watcherConfig: normalizeWatcherConfig(row.watcher_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } as Workflow;
};

export const getWorkflowById = (workflowId: string): Workflow | null => {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId) as any;
  if (!row) {
    return null;
  }
  const tasks = db
    .prepare('SELECT * FROM tasks WHERE workflow_id = ? ORDER BY task_order ASC')
    .all(workflowId) as any[];
  const files = db
    .prepare('SELECT * FROM workflow_files WHERE workflow_id = ? ORDER BY added_at ASC')
    .all(workflowId) as any[];
  const historyRows = db
    .prepare('SELECT * FROM workflow_history WHERE workflow_id = ? ORDER BY created_at DESC')
    .all(workflowId) as any[];

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    tasks: tasks.map(deserializeWorkflowTask),
    executionMode: row.execution_mode,
    maxParallel: row.max_parallel ?? undefined,
    fileQueue: files.map(deserializeWorkflowFile),
    history: historyRows.map(deserializeWorkflowHistory),
    status: row.status,
    watcherConfig: normalizeWatcherConfig(row.watcher_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  } as Workflow;
};

export const hasProcessedFile = (workflowId: string, filePath: string): boolean => {
  const db = getDatabase();
  const row = db
    .prepare('SELECT 1 FROM processed_files WHERE workflow_id = ? AND file_path = ? LIMIT 1')
    .get(workflowId, filePath) as { 1: number } | undefined;
  return Boolean(row);
};

export const recordProcessedFile = (workflowId: string, filePath: string) => {
  const db = getDatabase();
  try {
    db.prepare(
      'INSERT INTO processed_files (workflow_id, file_path, processed_at) VALUES (?, ?, ?)'
    ).run(workflowId, filePath, new Date().toISOString());
  } catch {
    // ignore duplicates
  }
};

export const archiveWorkflowFile = (
  workflowId: string,
  file: WorkflowFile,
  status: WorkflowFileHistory['status'],
  taskStatuses: WorkflowTaskStatus[]
) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO workflow_history (id, workflow_id, file_path, status, started_at, completed_at, error, task_statuses, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    file.id,
    workflowId,
    file.filePath,
    status,
    file.startedAt ?? null,
    file.completedAt ?? null,
    file.error ?? null,
    JSON.stringify(taskStatuses),
    now
  );

  db.prepare('DELETE FROM workflow_files WHERE id = ?').run(file.id);
  db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(now, workflowId);
};

export const updateWorkflowStatus = (workflowId: string, status: Workflow['status']) => {
  const db = getDatabase();
  db.prepare('UPDATE workflows SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    new Date().toISOString(),
    workflowId
  );
};

export const updateWorkflowFileStatus = (
  fileId: string,
  status: WorkflowFile['status'],
  extra?: { error?: string; startedAt?: string; completedAt?: string; currentTaskIndex?: number }
) => {
  const db = getDatabase();
  db.prepare(
    'UPDATE workflow_files SET status = ?, error = ?, started_at = ?, completed_at = ?, current_task_index = ? WHERE id = ?'
  ).run(
    status,
    extra?.error ?? null,
    extra?.startedAt ?? null,
    extra?.completedAt ?? null,
    extra?.currentTaskIndex ?? null,
    fileId
  );
};

export const removeWorkflowFile = (workflowId: string, fileId: string) => {
  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM workflow_files WHERE id = ? AND workflow_id = ?')
    .run(fileId, workflowId);
  if (result.changes > 0) {
    db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
  }
  return result.changes > 0;
};

export const removeWorkflowHistoryItem = (workflowId: string, historyId: string) => {
  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM workflow_history WHERE id = ? AND workflow_id = ?')
    .run(historyId, workflowId);
  if (result.changes > 0) {
    db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
  }
  return result.changes > 0;
};

export const clearWorkflowHistory = (workflowId: string) => {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM workflow_history WHERE workflow_id = ?').run(workflowId);
  if (result.changes > 0) {
    db.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), workflowId);
  }
  return result.changes;
};
