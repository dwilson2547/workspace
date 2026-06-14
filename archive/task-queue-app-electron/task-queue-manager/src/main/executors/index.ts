import { TaskConfig, TaskType } from '../../shared/types';
import { TaskExecutor } from './base';
import { CopyExecutor } from './copy';
import { ZipExecutor } from './zip';
import { TarExecutor } from './tar';
import { TranscodeExecutor } from './transcode';
import { RsyncExecutor } from './rsync';
import { DeleteExecutor } from './delete';
import { CustomExecutor } from './custom';

export * from './base';
export { CopyExecutor } from './copy';
export { ZipExecutor } from './zip';
export { TarExecutor } from './tar';
export { TranscodeExecutor } from './transcode';
export { RsyncExecutor } from './rsync';
export { DeleteExecutor } from './delete';
export { CustomExecutor } from './custom';

// Executor instances (singletons)
const executors: Record<TaskType, TaskExecutor> = {
  copy: new CopyExecutor(),
  zip: new ZipExecutor(),
  tar: new TarExecutor(),
  transcode: new TranscodeExecutor(),
  rsync: new RsyncExecutor(),
  delete: new DeleteExecutor(),
  custom: new CustomExecutor(),
};

export function getExecutor(type: TaskType): TaskExecutor {
  const executor = executors[type];
  if (!executor) {
    throw new Error(`Unknown task type: ${type}`);
  }
  return executor;
}

export function validateTaskConfig(config: TaskConfig): { valid: boolean; error?: string } {
  const executor = getExecutor(config.type);
  if (executor.validate) {
    return executor.validate(config);
  }
  return { valid: true };
}
