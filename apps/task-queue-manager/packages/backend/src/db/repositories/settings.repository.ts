import { getDatabase } from '../index';
import type { AppSettings } from '@tqm/shared';
import { DEFAULT_APP_SETTINGS } from '@tqm/shared';

interface SettingsRow {
  id: number;
  pause_all_on_startup: number;
  theme: string;
  download_defaults: string;
}

function rowToSettings(row: SettingsRow): AppSettings {
  return {
    pauseAllOnStartup: row.pause_all_on_startup === 1,
    theme: row.theme as AppSettings['theme'],
    downloadDefaults: JSON.parse(row.download_defaults),
  };
}

export function getSettings(): AppSettings {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as SettingsRow | undefined;

  if (!row) {
    // Return defaults if no settings exist
    return { ...DEFAULT_APP_SETTINGS };
  }

  return rowToSettings(row);
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const db = getDatabase();
  const existing = getSettings();
  const merged = {
    ...existing,
    ...updates,
    downloadDefaults: {
      ...existing.downloadDefaults,
      ...(updates.downloadDefaults || {}),
    },
  };

  // Ensure settings row exists
  const exists = db.prepare('SELECT id FROM app_settings WHERE id = 1').get();
  if (!exists) {
    db.prepare(`
      INSERT INTO app_settings (id, pause_all_on_startup, theme, download_defaults)
      VALUES (1, ?, ?, ?)
    `).run(
      merged.pauseAllOnStartup ? 1 : 0,
      merged.theme,
      JSON.stringify(merged.downloadDefaults)
    );
  } else {
    db.prepare(`
      UPDATE app_settings
      SET pause_all_on_startup = ?, theme = ?, download_defaults = ?
      WHERE id = 1
    `).run(
      merged.pauseAllOnStartup ? 1 : 0,
      merged.theme,
      JSON.stringify(merged.downloadDefaults)
    );
  }

  return merged;
}
