import { ipcMain } from 'electron';
import { IPC_CHANNELS, Workflow } from '@tqm/shared';
import * as repo from '../db/repositories';

export function registerWorkflowHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INVOKE.GET_WORKFLOWS, async () => {
    return repo.getWorkflows();
  });

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.CREATE_WORKFLOW,
    async (_, args: { config: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'> }) => {
      return repo.createWorkflow(args.config);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.UPDATE_WORKFLOW,
    async (_, args: Partial<Workflow> & { id: string }) => {
      const { id, ...updates } = args;
      return repo.updateWorkflow(id, updates);
    }
  );

  ipcMain.handle(IPC_CHANNELS.INVOKE.DELETE_WORKFLOW, async (_, args: { id: string }) => {
    repo.deleteWorkflow(args.id);
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.START_WORKFLOW, async (_, args: { id: string }) => {
    return repo.startWorkflow(args.id);
  });

  ipcMain.handle(IPC_CHANNELS.INVOKE.PAUSE_WORKFLOW, async (_, args: { id: string }) => {
    return repo.pauseWorkflow(args.id);
  });
}
