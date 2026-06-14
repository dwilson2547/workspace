import { ChildProcess } from 'child_process';
import { TaskConfig, TaskStatus } from '../../shared/types';

export interface ExecutorProgress {
  progress: number; // 0-100
  message?: string;
}

export interface ExecutorResult {
  success: boolean;
  error?: string;
}

export type ProgressCallback = (progress: ExecutorProgress) => void;
export type CancellationToken = { cancelled: boolean };

export interface TaskExecutor<T extends TaskConfig = TaskConfig> {
  execute(
    config: T,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult>;
  
  // Optional: Validate config before execution
  validate?(config: T): { valid: boolean; error?: string };
}

// Helper to kill a process tree (important for child processes)
export function killProcessTree(process: ChildProcess): void {
  if (process.pid) {
    try {
      // On Windows, use taskkill. On Unix, use kill with negative PID
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`taskkill /pid ${process.pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(-process.pid, 'SIGKILL');
      }
    } catch {
      // Process might already be dead
      process.kill('SIGKILL');
    }
  }
}
