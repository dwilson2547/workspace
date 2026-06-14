import { ipcMain } from 'electron';
import { IPC_CHANNELS, AppSettings } from '@tqm/shared';
import * as repo from '../db/repositories';

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INVOKE.GET_SETTINGS, async () => {
    return repo.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.UPDATE_SETTINGS, async (_, args: Partial<AppSettings>) => {
    return repo.updateSettings(args);
  });
}
