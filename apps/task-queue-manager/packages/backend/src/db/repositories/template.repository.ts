import { getDatabase, generateId, now } from '../index';
import type { TaskTemplate, TaskType, TaskConfig } from '@tqm/shared';

interface TaskTemplateRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  base_task: string;
  config: string;
  locked_fields: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTemplate(row: TaskTemplateRow): TaskTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    icon: row.icon ?? undefined,
    baseTask: row.base_task as TaskType,
    config: JSON.parse(row.config) as Partial<TaskConfig>,
    lockedFields: row.locked_fields ? JSON.parse(row.locked_fields) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getTaskTemplates(): TaskTemplate[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM task_templates ORDER BY name ASC')
    .all() as TaskTemplateRow[];
  return rows.map(rowToTemplate);
}

export function getTaskTemplate(id: string): TaskTemplate | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as TaskTemplateRow | undefined;
  return row ? rowToTemplate(row) : null;
}

export function createTaskTemplate(
  template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
): TaskTemplate {
  const db = getDatabase();
  const id = generateId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO task_templates (id, name, description, icon, base_task, config, locked_fields, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    template.name,
    template.description ?? null,
    template.icon ?? null,
    template.baseTask,
    JSON.stringify(template.config),
    template.lockedFields.length > 0 ? JSON.stringify(template.lockedFields) : null,
    timestamp,
    timestamp
  );

  return {
    id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    baseTask: template.baseTask,
    config: template.config,
    lockedFields: template.lockedFields,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateTaskTemplate(
  id: string,
  updates: Partial<Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): TaskTemplate {
  const db = getDatabase();
  const existing = getTaskTemplate(id);
  if (!existing) {
    throw new Error(`Task template not found: ${id}`);
  }

  const timestamp = now();
  const name = updates.name ?? existing.name;
  const description = updates.description ?? existing.description;
  const icon = updates.icon ?? existing.icon;
  const baseTask = updates.baseTask ?? existing.baseTask;
  const config = updates.config ?? existing.config;
  const lockedFields = updates.lockedFields ?? existing.lockedFields;

  db.prepare(`
    UPDATE task_templates
    SET name = ?, description = ?, icon = ?, base_task = ?, config = ?, locked_fields = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name,
    description ?? null,
    icon ?? null,
    baseTask,
    JSON.stringify(config),
    lockedFields.length > 0 ? JSON.stringify(lockedFields) : null,
    timestamp,
    id
  );

  return {
    ...existing,
    name,
    description,
    icon,
    baseTask,
    config,
    lockedFields,
    updatedAt: timestamp,
  };
}

export function deleteTaskTemplate(id: string): void {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM task_templates WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`Task template not found: ${id}`);
  }
}
