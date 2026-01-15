import fs from 'node:fs/promises';
import type { Task } from '../src/shared/types';

export const runTask = async (task: Task) => {
  switch (task.type) {
    case 'copy':
      if (!task.config.destinationPath) {
        throw new Error('Copy task missing destination path');
      }
      await fs.copyFile(task.config.sourcePath, task.config.destinationPath);
      break;
    case 'move':
      if (!task.config.destinationPath) {
        throw new Error('Move task missing destination path');
      }
      await fs.rename(task.config.sourcePath, task.config.destinationPath);
      break;
    case 'delete':
      await fs.rm(task.config.sourcePath, { force: true, recursive: true });
      break;
    default:
      throw new Error(`Unsupported task type: ${task.type}`);
  }
};
