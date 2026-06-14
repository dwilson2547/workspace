import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@tqm/shared';

// Build whitelist from shared constants
const validInvokeChannels = Object.values(IPC_CHANNELS.INVOKE) as string[];
const validEventChannels = Object.values(IPC_CHANNELS.EVENTS) as string[];

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoke an IPC handler on the main process
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid invoke channel: ${channel}`);
  },

  /**
   * Subscribe to events from the main process
   * Returns an unsubscribe function
   */
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (validEventChannels.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
        callback(...args);
      };
      ipcRenderer.on(channel, subscription);

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    throw new Error(`Invalid event channel: ${channel}`);
  },
});
