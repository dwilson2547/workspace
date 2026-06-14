import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS, FileDialogOptions } from '@tqm/shared';

export function registerDialogHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    IPC_CHANNELS.INVOKE.SELECT_DIRECTORY,
    async (_, args?: { title?: string }) => {
      const window = getMainWindow();
      if (!window) return null;

      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory'],
        title: args?.title ?? 'Select Directory',
      });

      return result.canceled ? null : result.filePaths[0];
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.SELECT_FILES,
    async (_, options?: FileDialogOptions) => {
      const window = getMainWindow();
      if (!window) return [];

      const properties: ('openFile' | 'multiSelections')[] = ['openFile'];
      if (options?.multiple) {
        properties.push('multiSelections');
      }

      const result = await dialog.showOpenDialog(window, {
        properties,
        title: options?.title ?? 'Select Files',
        filters: options?.filters,
      });

      return result.canceled ? [] : result.filePaths;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.SELECT_FILE,
    async (_, options?: FileDialogOptions) => {
      const window = getMainWindow();
      if (!window) return null;

      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        title: options?.title ?? 'Select File',
        filters: options?.filters,
      });

      return result.canceled ? null : result.filePaths[0];
    }
  );
}
