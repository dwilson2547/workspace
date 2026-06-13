import { ipcMain } from 'electron';
import { IPC_CHANNELS, UserContext, HeaderPreset, TaskTemplate } from '@tqm/shared';
import * as repo from '../db/repositories';

export function registerPresetHandlers(): void {
  // ─────────────────────────────────────────────────────────────────────────
  // User Context Handlers
  // ─────────────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INVOKE.GET_USER_CONTEXTS, async () => {
    return repo.getUserContexts();
  });

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.CREATE_USER_CONTEXT,
    async (_, args: { context: Omit<UserContext, 'id' | 'isBuiltIn'> }) => {
      return repo.createUserContext(args.context);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.UPDATE_USER_CONTEXT,
    async (_, args: Partial<UserContext> & { id: string }) => {
      const { id, ...updates } = args;
      return repo.updateUserContext(id, updates);
    }
  );

  ipcMain.handle(IPC_CHANNELS.INVOKE.DELETE_USER_CONTEXT, async (_, args: { id: string }) => {
    repo.deleteUserContext(args.id);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Header Preset Handlers
  // ─────────────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INVOKE.GET_HEADER_PRESETS, async () => {
    return repo.getHeaderPresets();
  });

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.CREATE_HEADER_PRESET,
    async (_, args: { preset: Omit<HeaderPreset, 'id' | 'createdAt' | 'updatedAt'> }) => {
      return repo.createHeaderPreset(args.preset);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.UPDATE_HEADER_PRESET,
    async (_, args: Partial<HeaderPreset> & { id: string }) => {
      const { id, ...updates } = args;
      return repo.updateHeaderPreset(id, updates);
    }
  );

  ipcMain.handle(IPC_CHANNELS.INVOKE.DELETE_HEADER_PRESET, async (_, args: { id: string }) => {
    repo.deleteHeaderPreset(args.id);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Task Template Handlers
  // ─────────────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.INVOKE.GET_TASK_TEMPLATES, async () => {
    return repo.getTaskTemplates();
  });

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.CREATE_TASK_TEMPLATE,
    async (_, args: { template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'> }) => {
      return repo.createTaskTemplate(args.template);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVOKE.UPDATE_TASK_TEMPLATE,
    async (_, args: Partial<TaskTemplate> & { id: string }) => {
      const { id, ...updates } = args;
      return repo.updateTaskTemplate(id, updates);
    }
  );

  ipcMain.handle(IPC_CHANNELS.INVOKE.DELETE_TASK_TEMPLATE, async (_, args: { id: string }) => {
    repo.deleteTaskTemplate(args.id);
  });
}
