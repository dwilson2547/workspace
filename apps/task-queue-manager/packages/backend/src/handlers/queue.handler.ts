import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@tqm/shared';
import * as repo from '../db/repositories';

export function registerQueueHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INVOKE.GET_QUEUES, async () => {
    return repo.getQueues();
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.CREATE_QUEUE, async (_, args: { name: string; maxParallel?: number }) => {
    return repo.createQueue(args.name, args.maxParallel);
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.UPDATE_QUEUE, async (_, args: { id: string; name?: string; maxParallel?: number }) => {
    return repo.updateQueue(args.id, {
      name: args.name,
      maxParallel: args.maxParallel,
    });
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.DELETE_QUEUE, async (_, args: { id: string }) => {
    repo.deleteQueue(args.id);
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.START_QUEUE, async (_, args: { id: string }) => {
    return repo.startQueue(args.id);
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.PAUSE_QUEUE, async (_, args: { id: string }) => {
    return repo.pauseQueue(args.id);
  });
}
