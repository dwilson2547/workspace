import { spawn } from 'child_process';
import * as fs from 'fs';
import { RsyncTaskConfig } from '../../shared/types';
import { TaskExecutor, ProgressCallback, CancellationToken, ExecutorResult, killProcessTree } from './base';

export class RsyncExecutor implements TaskExecutor<RsyncTaskConfig> {
  validate(config: RsyncTaskConfig): { valid: boolean; error?: string } {
    if (!config.source) {
      return { valid: false, error: 'Source path is required' };
    }
    if (!config.destination) {
      return { valid: false, error: 'Destination path is required' };
    }
    // For local sources, check existence
    if (!config.source.includes(':') && !fs.existsSync(config.source)) {
      return { valid: false, error: `Source does not exist: ${config.source}` };
    }
    return { valid: true };
  }

  async execute(
    config: RsyncTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const validation = this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check if rsync is available
    if (!this.hasRsync()) {
      return { success: false, error: 'rsync not found. Please install rsync.' };
    }

    onProgress({ progress: 0, message: 'Starting rsync...' });

    try {
      const args = this.buildArgs(config);
      return await this.runRsync(args, onProgress, cancellationToken);
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  private hasRsync(): boolean {
    try {
      const { execSync } = require('child_process');
      const which = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${which} rsync`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private buildArgs(config: RsyncTaskConfig): string[] {
    const args: string[] = [];

    // Archive mode (preserves permissions, timestamps, etc.)
    if (config.archive !== false) {
      args.push('-a');
    }

    // Human-readable output
    args.push('-h');

    // Progress info
    args.push('--info=progress2');

    // Compression
    if (config.compress) {
      args.push('-z');
    }

    // Delete extraneous files from destination
    if (config.delete) {
      args.push('--delete');
    }

    // Dry run
    if (config.dryRun) {
      args.push('--dry-run');
    }

    // Exclude patterns
    if (config.exclude && config.exclude.length > 0) {
      for (const pattern of config.exclude) {
        args.push('--exclude', pattern);
      }
    }

    // Include patterns
    if (config.include && config.include.length > 0) {
      for (const pattern of config.include) {
        args.push('--include', pattern);
      }
    }

    // Source and destination
    args.push(config.source, config.destination);

    return args;
  }

  private runRsync(
    args: string[],
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    return new Promise((resolve) => {
      const proc = spawn('rsync', args, { detached: true });
      let lastProgress = 0;
      let lastMessage = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        
        // Parse progress from rsync output
        // Format: "1,234,567  12%  123.45MB/s    0:00:12"
        const progressMatch = output.match(/(\d+)%/);
        if (progressMatch) {
          lastProgress = parseInt(progressMatch[1], 10);
        }

        // Try to get transfer info
        const speedMatch = output.match(/(\d+(?:\.\d+)?[KMGT]?B\/s)/);
        const etaMatch = output.match(/(\d+:\d+:\d+)/);
        
        let message = `Syncing... ${lastProgress}%`;
        if (speedMatch) {
          message += ` @ ${speedMatch[1]}`;
        }
        if (etaMatch) {
          message += ` ETA: ${etaMatch[1]}`;
        }
        
        lastMessage = message;
        onProgress({ progress: lastProgress, message: lastMessage });
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const checkCancellation = setInterval(() => {
        if (cancellationToken.cancelled) {
          clearInterval(checkCancellation);
          killProcessTree(proc);
          resolve({ success: false, error: 'Task cancelled' });
        }
      }, 100);

      proc.on('close', (code) => {
        clearInterval(checkCancellation);
        if (cancellationToken.cancelled) return;

        if (code === 0) {
          onProgress({ progress: 100, message: 'Sync complete' });
          resolve({ success: true });
        } else {
          // rsync exit codes
          const errorMessages: Record<number, string> = {
            1: 'Syntax or usage error',
            2: 'Protocol incompatibility',
            3: 'Errors selecting input/output files',
            4: 'Requested action not supported',
            5: 'Error starting client-server protocol',
            6: 'Daemon unable to append to log-file',
            10: 'Error in socket I/O',
            11: 'Error in file I/O',
            12: 'Error in rsync protocol data stream',
            13: 'Errors with program diagnostics',
            14: 'Error in IPC code',
            20: 'Received SIGUSR1 or SIGINT',
            21: 'Some error returned by waitpid()',
            22: 'Error allocating core memory buffers',
            23: 'Partial transfer due to error',
            24: 'Partial transfer due to vanished source files',
            25: 'The --max-delete limit stopped deletions',
            30: 'Timeout in data send/receive',
            35: 'Timeout waiting for daemon connection',
          };

          const errorMsg = errorMessages[code || 0] || stderr || `rsync exited with code ${code}`;
          resolve({ success: false, error: errorMsg });
        }
      });

      proc.on('error', (err) => {
        clearInterval(checkCancellation);
        resolve({ success: false, error: err.message });
      });
    });
  }
}
