import { getDatabase, generateId, now } from '../index';
import type { UserContext, HeaderPreset } from '@tqm/shared';

// ─────────────────────────────────────────────────────────────────────────────
// User Context Repository
// ─────────────────────────────────────────────────────────────────────────────

interface UserContextRow {
  id: string;
  name: string;
  description: string | null;
  is_built_in: number;
  headers: string;
  created_at: string;
  updated_at: string;
}

function rowToUserContext(row: UserContextRow): UserContext {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    isBuiltIn: row.is_built_in === 1,
    headers: JSON.parse(row.headers),
  };
}

export function getUserContexts(): UserContext[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM user_contexts ORDER BY is_built_in DESC, name ASC')
    .all() as UserContextRow[];
  return rows.map(rowToUserContext);
}

export function getUserContext(id: string): UserContext | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM user_contexts WHERE id = ?').get(id) as UserContextRow | undefined;
  return row ? rowToUserContext(row) : null;
}

export function createUserContext(
  context: Omit<UserContext, 'id' | 'isBuiltIn'>
): UserContext {
  const db = getDatabase();
  const id = generateId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO user_contexts (id, name, description, is_built_in, headers, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?, ?)
  `).run(id, context.name, context.description ?? null, JSON.stringify(context.headers), timestamp, timestamp);

  return {
    id,
    name: context.name,
    description: context.description,
    isBuiltIn: false,
    headers: context.headers,
  };
}

export function updateUserContext(
  id: string,
  updates: Partial<Omit<UserContext, 'id' | 'isBuiltIn'>>
): UserContext {
  const db = getDatabase();
  const existing = getUserContext(id);
  if (!existing) {
    throw new Error(`User context not found: ${id}`);
  }
  if (existing.isBuiltIn) {
    throw new Error('Cannot modify built-in user context');
  }

  const timestamp = now();
  const name = updates.name ?? existing.name;
  const description = updates.description ?? existing.description;
  const headers = updates.headers ?? existing.headers;

  db.prepare(`
    UPDATE user_contexts
    SET name = ?, description = ?, headers = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description ?? null, JSON.stringify(headers), timestamp, id);

  return {
    ...existing,
    name,
    description,
    headers,
  };
}

export function deleteUserContext(id: string): void {
  const db = getDatabase();
  const existing = getUserContext(id);
  if (!existing) {
    throw new Error(`User context not found: ${id}`);
  }
  if (existing.isBuiltIn) {
    throw new Error('Cannot delete built-in user context');
  }

  db.prepare('DELETE FROM user_contexts WHERE id = ?').run(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Header Preset Repository
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderPresetRow {
  id: string;
  name: string;
  description: string | null;
  headers: string;
  created_at: string;
  updated_at: string;
}

function rowToHeaderPreset(row: HeaderPresetRow): HeaderPreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    headers: JSON.parse(row.headers),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getHeaderPresets(): HeaderPreset[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM header_presets ORDER BY name ASC')
    .all() as HeaderPresetRow[];
  return rows.map(rowToHeaderPreset);
}

export function getHeaderPreset(id: string): HeaderPreset | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM header_presets WHERE id = ?').get(id) as HeaderPresetRow | undefined;
  return row ? rowToHeaderPreset(row) : null;
}

export function createHeaderPreset(
  preset: Omit<HeaderPreset, 'id' | 'createdAt' | 'updatedAt'>
): HeaderPreset {
  const db = getDatabase();
  const id = generateId();
  const timestamp = now();

  db.prepare(`
    INSERT INTO header_presets (id, name, description, headers, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, preset.name, preset.description ?? null, JSON.stringify(preset.headers), timestamp, timestamp);

  return {
    id,
    name: preset.name,
    description: preset.description,
    headers: preset.headers,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateHeaderPreset(
  id: string,
  updates: Partial<Omit<HeaderPreset, 'id' | 'createdAt' | 'updatedAt'>>
): HeaderPreset {
  const db = getDatabase();
  const existing = getHeaderPreset(id);
  if (!existing) {
    throw new Error(`Header preset not found: ${id}`);
  }

  const timestamp = now();
  const name = updates.name ?? existing.name;
  const description = updates.description ?? existing.description;
  const headers = updates.headers ?? existing.headers;

  db.prepare(`
    UPDATE header_presets
    SET name = ?, description = ?, headers = ?, updated_at = ?
    WHERE id = ?
  `).run(name, description ?? null, JSON.stringify(headers), timestamp, id);

  return {
    ...existing,
    name,
    description,
    headers,
    updatedAt: timestamp,
  };
}

export function deleteHeaderPreset(id: string): void {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM header_presets WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`Header preset not found: ${id}`);
  }
}
