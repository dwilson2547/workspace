import * as fs from 'fs';
import * as path from 'path';
import { shell } from 'electron';
import { DeleteTaskConfig } from '../../shared/types';
import { TaskExecutor, ProgressCallback, CancellationToken, ExecutorResult } from './base';

export class DeleteExecutor implements TaskExecutor<DeleteTaskConfig> {
  validate(config: DeleteTaskConfig): { valid: boolean; error?: string } {
    if (!config.paths || config.paths.length === 0) {
      return { valid: false, error: 'At least one path is required' };
    }
    return { valid: true };
  }

  async execute(
    config: DeleteTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const validation = this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const errors: string[] = [];
    const totalPaths = config.paths.length;

    for (let i = 0; i < config.paths.length; i++) {
      if (cancellationToken.cancelled) {
        return { success: false, error: 'Task cancelled' };
      }

      const filePath = config.paths[i];
      const progress = Math.round(((i + 1) / totalPaths) * 100);
      
      onProgress({ 
        progress: Math.min(progress, 99), 
        message: `Deleting ${i + 1}/${totalPaths}: ${path.basename(filePath)}` 
      });

      try {
        if (!fs.existsSync(filePath)) {
          // Already deleted or doesn't exist - not an error
          continue;
        }

        if (config.moveToTrash) {
          // Move to system trash
          const success = await shell.trashItem(filePath);
          if (!success) {
            errors.push(`Failed to move to trash: ${filePath}`);
          }
        } else {
          // Permanently delete
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            if (config.recursive) {
              await this.deleteDirectory(filePath, config.force ?? false);
            } else {
              // Try to remove empty directory
              try {
                fs.rmdirSync(filePath);
              } catch (err: any) {
                if (err.code === 'ENOTEMPTY') {
                  errors.push(`Directory not empty (use recursive): ${filePath}`);
                } else {
                  throw err;
                }
              }
            }
          } else {
            // Delete file
            if (config.force) {
              // Remove read-only flag if force is enabled
              try {
                fs.chmodSync(filePath, 0o666);
              } catch {
                // Ignore chmod errors
              }
            }
            fs.unlinkSync(filePath);
          }
        }
      } catch (err: any) {
        errors.push(`${filePath}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: `Failed to delete ${errors.length} item(s):\n${errors.join('\n')}`
      };
    }

    onProgress({ progress: 100, message: 'Delete complete' });
    return { success: true };
  }

  private async deleteDirectory(dirPath: string, force: boolean): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.deleteDirectory(fullPath, force);
      } else {
        if (force) {
          try {
            fs.chmodSync(fullPath, 0o666);
          } catch {
            // Ignore chmod errors
          }
        }
        fs.unlinkSync(fullPath);
      }
    }

    // Remove the now-empty directory
    fs.rmdirSync(dirPath);
  }
}
