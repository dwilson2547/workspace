import { BrowserWindow } from 'electron';
import { registerQueueHandlers } from './queue.handler';
import { registerTaskHandlers } from './task.handler';
import { registerWorkflowHandlers } from './workflow.handler';
import { registerSettingsHandlers } from './settings.handler';
import { registerPresetHandlers } from './preset.handler';
import { registerSystemHandlers } from './system.handler';
import { registerDialogHandlers } from './dialog.handler';

export function registerAllHandlers(getMainWindow: () => BrowserWindow | null): void {
  registerQueueHandlers();
  registerTaskHandlers();
  registerWorkflowHandlers();
  registerSettingsHandlers();
  registerPresetHandlers();
  registerSystemHandlers();
  registerDialogHandlers(getMainWindow);
}
