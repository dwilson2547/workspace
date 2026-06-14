import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { CopyTaskConfig } from '../../shared/types';
import { TaskExecutor, ProgressCallback, CancellationToken, ExecutorResult, killProcessTree } from './base';

export class CopyExecutor implements TaskExecutor<CopyTaskConfig> {
  validate(config: CopyTaskConfig): { valid: boolean; error?: string } {
    if (!config.source) {
      return { valid: false, error: 'Source path is required' };
    }
    if (!config.destination) {
      return { valid: false, error: 'Destination path is required' };
    }
    if (!fs.existsSync(config.source)) {
      return { valid: false, error: `Source does not exist: ${config.source}` };
    }
    return { valid: true };
  }

  async execute(
    config: CopyTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const validation = this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    onProgress({ progress: 0, message: 'Starting copy...' });

    const isDirectory = fs.statSync(config.source).isDirectory();

    try {
      if (process.platform === 'win32') {
        // Use robocopy on Windows for better progress
        return await this.copyWithRobocopy(config, onProgress, cancellationToken);
      } else {
        // Use rsync or cp on Unix
        if (this.hasRsync()) {
          return await this.copyWithRsync(config, onProgress, cancellationToken);
        } else {
          return await this.copyWithCp(config, onProgress, cancellationToken, isDirectory);
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  private hasRsync(): boolean {
    try {
      require('child_process').execSync('which rsync', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async copyWithRsync(
    config: CopyTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    return new Promise((resolve) => {
      const args = ['-ah', '--info=progress2'];
      if (!config.overwrite) {
        args.push('--ignore-existing');
      }
      args.push(config.source, config.destination);

      const proc = spawn('rsync', args, { detached: true });
      let lastProgress = 0;

      proc.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        const match = output.match(/(\d+)%/);
        if (match) {
          lastProgress = parseInt(match[1], 10);
          onProgress({ progress: lastProgress, message: `Copying... ${lastProgress}%` });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        console.error('rsync stderr:', data.toString());
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
          onProgress({ progress: 100, message: 'Copy complete' });
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `rsync exited with code ${code}` });
        }
      });

      proc.on('error', (err) => {
        clearInterval(checkCancellation);
        resolve({ success: false, error: err.message });
      });
    });
  }

  private async copyWithCp(
    config: CopyTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken,
    isDirectory: boolean
  ): Promise<ExecutorResult> {
    return new Promise((resolve) => {
      const args = isDirectory ? ['-r'] : [];
      if (!config.overwrite) {
        args.push('-n'); // Don't overwrite
      }
      args.push(config.source, config.destination);

      const proc = spawn('cp', args, { detached: true });

      // cp doesn't provide progress, so we'll just show indeterminate
      onProgress({ progress: 50, message: 'Copying...' });

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
          onProgress({ progress: 100, message: 'Copy complete' });
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `cp exited with code ${code}` });
        }
      });

      proc.on('error', (err) => {
        clearInterval(checkCancellation);
        resolve({ success: false, error: err.message });
      });
    });
  }

  private async copyWithRobocopy(
    config: CopyTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    return new Promise((resolve) => {
      const isDirectory = fs.statSync(config.source).isDirectory();
      
      let proc;
      if (isDirectory) {
        const args = [config.source, config.destination, '/E', '/NP', '/NDL'];
        if (!config.overwrite) {
          args.push('/XC', '/XN', '/XO'); // Exclude changed/newer/older
        }
        proc = spawn('robocopy', args, { detached: true, shell: true });
      } else {
        // For single files, use copy command
        const destDir = path.dirname(config.destination);
        const destFile = path.basename(config.destination);
        const args = config.overwrite ? ['/Y'] : [];
        args.push(config.source, path.join(destDir, destFile));
        proc = spawn('copy', args, { detached: true, shell: true });
      }

      onProgress({ progress: 50, message: 'Copying...' });

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
        
        // Robocopy returns various success codes
        if (code !== null && code < 8) {
          onProgress({ progress: 100, message: 'Copy complete' });
          resolve({ success: true });
        } else {
          resolve({ success: false, error: `Copy failed with code ${code}` });
        }
      });

      proc.on('error', (err) => {
        clearInterval(checkCancellation);
        resolve({ success: false, error: err.message });
      });
    });
  }
}
