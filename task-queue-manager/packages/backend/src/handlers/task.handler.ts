import { ipcMain } from 'electron';
import { IPC_CHANNELS, TaskType, TaskConfig } from '@tqm/shared';
import * as repo from '../db/repositories';

export function registerTaskHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INVOKE.GET_TASKS, async (_, args: { queueId: string }) => {
    return repo.getTasks(args.queueId);
  });

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.CREATE_TASK,
    async (_, args: { queueId: string; type: TaskType; config: TaskConfig }) => {
      return repo.createTask(args.queueId, args.type, args.config);
    }
  );

  ipcMain.handle(IPC_CHANNELS.INVOKE.CANCEL_TASK, async (_, args: { id: string }) => {
    return repo.cancelTask(args.id);
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.DELETE_TASK, async (_, args: { id: string }) => {
    repo.deleteTask(args.id);
  });
}
