import { getDatabase, generateId, now } from '../index';
import type {
  Workflow,
  WorkflowType,
  WorkflowStatus,
  WorkflowTrigger,
  WorkflowExecution,
  WorkflowOutput,
  WorkflowRecovery,
  WorkflowWatchOptions,
  WorkflowTaskDefinition,
} from '@tqm/shared';

interface WorkflowRow {
  id: string;
  name: string;
  type: string;
  status: string;
  trigger_type: string;
  trigger_path: string | null;
  trigger_pattern: string | null;
  trigger_recursive: number;
  trigger_max_depth: number | null;
  trigger_process_existing: number;
  trigger_newer_than: string | null;
  execution_mode: string;
  execution_max_parallel: number;
  output_directory: string | null;
  output_name_template: string | null;
  recovery_interrupted: string;
  recovery_check_missed: number;
  watch_ignore_temp: number;
  watch_temp_patterns: string | null;
  watch_ignore_hidden: number;
  watch_min_file_size: number | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowTaskRow {
  id: string;
  workflow_id: string;
  position: number;
  task_type: string;
  config: string;
  on_error: string;
  created_at: string;
}

function rowToWorkflow(row: WorkflowRow, tasks: WorkflowTaskDefinition[]): Workflow {
  const trigger: WorkflowTrigger = {
    type: row.trigger_type as WorkflowTrigger['type'],
    path: row.trigger_path ?? undefined,
    filePattern: row.trigger_pattern ?? undefined,
    recursive: row.trigger_recursive === 1,
    maxDepth: row.trigger_max_depth ?? undefined,
    processExistingOnStart: row.trigger_process_existing === 1,
    existingFilesNewerThan: row.trigger_newer_than ?? undefined,
  };

  const execution: WorkflowExecution = {
    mode: row.execution_mode as WorkflowExecution['mode'],
    maxParallel: row.execution_max_parallel,
  };

  const output: WorkflowOutput = {
    directory: row.output_directory ?? '',
    nameTemplate: row.output_name_template ?? '{filename}.{ext}',
  };

  const recovery: WorkflowRecovery = {
    interruptedFiles: row.recovery_interrupted as WorkflowRecovery['interruptedFiles'],
    checkMissedFiles: row.recovery_check_missed === 1,
  };

  let watchOptions: WorkflowWatchOptions | undefined;
  if (row.trigger_type === 'watch') {
    watchOptions = {
      ignoreTempFiles: row.watch_ignore_temp === 1,
      tempPatterns: row.watch_temp_patterns ? JSON.parse(row.watch_temp_patterns) : [],
      ignoreHiddenFiles: row.watch_ignore_hidden === 1,
      minFileSize: row.watch_min_file_size ?? undefined,
    };
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type as WorkflowType,
    status: row.status as WorkflowStatus,
    trigger,
    execution,
    output,
    tasks,
    recovery,
    watchOptions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getWorkflowTasks(workflowId: string): WorkflowTaskDefinition[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM workflow_tasks WHERE workflow_id = ? ORDER BY position')
    .all(workflowId) as WorkflowTaskRow[];

  return rows.map((row) => ({
    id: row.id,
    type: row.task_type as WorkflowTaskDefinition['type'],
    config: JSON.parse(row.config),
    onError: row.on_error as WorkflowTaskDefinition['onError'],
  }));
}

export function getWorkflows(): Workflow[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all() as WorkflowRow[];
  return rows.map((row) => rowToWorkflow(row, getWorkflowTasks(row.id)));
}

export function getWorkflow(id: string): Workflow | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined;
  if (!row) return null;
  return rowToWorkflow(row, getWorkflowTasks(id));
}

export function createWorkflow(
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>
): Workflow {
  const db = getDatabase();
  const id = generateId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO workflows (
      id, name, type, status,
      trigger_type, trigger_path, trigger_pattern, trigger_recursive,
      trigger_max_depth, trigger_process_existing, trigger_newer_than,
      execution_mode, execution_max_parallel,
      output_directory, output_name_template,
      recovery_interrupted, recovery_check_missed,
      watch_ignore_temp, watch_temp_patterns, watch_ignore_hidden, watch_min_file_size,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workflow.name,
    workflow.type,
    workflow.status,
    workflow.trigger.type,
    workflow.trigger.path ?? null,
    workflow.trigger.filePattern ?? null,
    workflow.trigger.recursive ? 1 : 0,
    workflow.trigger.maxDepth ?? null,
    workflow.trigger.processExistingOnStart ? 1 : 0,
    workflow.trigger.existingFilesNewerThan ?? null,
    workflow.execution.mode,
    workflow.execution.maxParallel ?? 1,
    workflow.output.directory,
    workflow.output.nameTemplate,
    workflow.recovery.interruptedFiles,
    workflow.recovery.checkMissedFiles ? 1 : 0,
    workflow.watchOptions?.ignoreTempFiles ? 1 : 0,
    workflow.watchOptions?.tempPatterns ? JSON.stringify(workflow.watchOptions.tempPatterns) : null,
    workflow.watchOptions?.ignoreHiddenFiles ? 1 : 0,
    workflow.watchOptions?.minFileSize ?? null,
    timestamp,
    timestamp
  );

  // Insert workflow tasks
  const insertTask = db.prepare(`
    INSERT INTO workflow_tasks (id, workflow_id, position, task_type, config, on_error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  workflow.tasks.forEach((task, index) => {
    insertTask.run(
      task.id || generateId(),
      id,
      index,
      task.type,
      JSON.stringify(task.config),
      task.onError,
      timestamp
    );
  });

  return {
    ...workflow,
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateWorkflow(
  id: string,
  updates: Partial<Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>>
): Workflow {
  const db = getDatabase();
  const existing = getWorkflow(id);
  if (!existing) {
    throw new Error(`Workflow not found: ${id}`);
  }

  const timestamp = now();
  const merged = { ...existing, ...updates };

  db.prepare(`
    UPDATE workflows SET
      name = ?, type = ?, status = ?,
      trigger_type = ?, trigger_path = ?, trigger_pattern = ?, trigger_recursive = ?,
      trigger_max_depth = ?, trigger_process_existing = ?, trigger_newer_than = ?,
      execution_mode = ?, execution_max_parallel = ?,
      output_directory = ?, output_name_template = ?,
      recovery_interrupted = ?, recovery_check_missed = ?,
      watch_ignore_temp = ?, watch_temp_patterns = ?, watch_ignore_hidden = ?, watch_min_file_size = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    merged.name,
    merged.type,
    merged.status,
    merged.trigger.type,
    merged.trigger.path ?? null,
    merged.trigger.filePattern ?? null,
    merged.trigger.recursive ? 1 : 0,
    merged.trigger.maxDepth ?? null,
    merged.trigger.processExistingOnStart ? 1 : 0,
    merged.trigger.existingFilesNewerThan ?? null,
    merged.execution.mode,
    merged.execution.maxParallel ?? 1,
    merged.output.directory,
    merged.output.nameTemplate,
    merged.recovery.interruptedFiles,
    merged.recovery.checkMissedFiles ? 1 : 0,
    merged.watchOptions?.ignoreTempFiles ? 1 : 0,
    merged.watchOptions?.tempPatterns ? JSON.stringify(merged.watchOptions.tempPatterns) : null,
    merged.watchOptions?.ignoreHiddenFiles ? 1 : 0,
    merged.watchOptions?.minFileSize ?? null,
    timestamp,
    id
  );

  // Update tasks if provided
  if (updates.tasks) {
    db.prepare('DELETE FROM workflow_tasks WHERE workflow_id = ?').run(id);
    const insertTask = db.prepare(`
      INSERT INTO workflow_tasks (id, workflow_id, position, task_type, config, on_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    updates.tasks.forEach((task, index) => {
      insertTask.run(
        task.id || generateId(),
        id,
        index,
        task.type,
        JSON.stringify(task.config),
        task.onError,
        timestamp
      );
    });
  }

  return {
    ...merged,
    updatedAt: timestamp,
  };
}

export function deleteWorkflow(id: string): void {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`Workflow not found: ${id}`);
  }
}

export function startWorkflow(id: string): Workflow {
  return updateWorkflow(id, { status: 'running' });
}

export function pauseWorkflow(id: string): Workflow {
  return updateWorkflow(id, { status: 'paused' });
}
