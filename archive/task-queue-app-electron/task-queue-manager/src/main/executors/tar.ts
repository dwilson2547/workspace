import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { TarTaskConfig } from '../../shared/types';
import { TaskExecutor, ProgressCallback, CancellationToken, ExecutorResult } from './base';

export class TarExecutor implements TaskExecutor<TarTaskConfig> {
  validate(config: TarTaskConfig): { valid: boolean; error?: string } {
    if (!config.inputs || config.inputs.length === 0) {
      return { valid: false, error: 'At least one input path is required' };
    }
    if (!config.output) {
      return { valid: false, error: 'Output path is required' };
    }
    
    for (const input of config.inputs) {
      if (!fs.existsSync(input)) {
        return { valid: false, error: `Input does not exist: ${input}` };
      }
    }
    
    return { valid: true };
  }

  async execute(
    config: TarTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const validation = this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      onProgress({ progress: 0, message: 'Preparing tarball...' });

      // Ensure output directory exists
      const outputDir = path.dirname(config.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Calculate total size for progress
      let totalSize = 0;
      for (const input of config.inputs) {
        totalSize += this.getSize(input);
      }

      let processedSize = 0;
      const updateProgress = (bytes: number) => {
        processedSize += bytes;
        const percent = totalSize > 0 ? Math.round((processedSize / totalSize) * 100) : 0;
        onProgress({ 
          progress: Math.min(percent, 99), 
          message: `Creating tarball... ${this.formatBytes(processedSize)} / ${this.formatBytes(totalSize)}` 
        });
      };

      // Determine output path (add .gz if gzipping)
      let outputPath = config.output;
      if (config.gzip && !outputPath.endsWith('.gz') && !outputPath.endsWith('.tgz')) {
        if (outputPath.endsWith('.tar')) {
          outputPath += '.gz';
        } else {
          outputPath += '.tar.gz';
        }
      } else if (!config.gzip && !outputPath.endsWith('.tar')) {
        outputPath += '.tar';
      }

      // Create the tarball
      await this.createTarball(config.inputs, outputPath, config.gzip ?? false, updateProgress, cancellationToken);

      if (cancellationToken.cancelled) {
        // Clean up partial file
        try { fs.unlinkSync(outputPath); } catch {}
        return { success: false, error: 'Task cancelled' };
      }

      onProgress({ progress: 100, message: 'Tarball complete' });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  private async createTarball(
    inputs: string[],
    output: string,
    gzip: boolean,
    onProgress: (bytes: number) => void,
    cancellationToken: CancellationToken
  ): Promise<void> {
    // Build the list of files to add
    const fileList: { path: string; cwd: string }[] = [];
    
    for (const input of inputs) {
      const stats = fs.statSync(input);
      const parentDir = path.dirname(input);
      const baseName = path.basename(input);
      
      if (stats.isDirectory()) {
        // For directories, we want to include the directory itself
        fileList.push({ path: baseName, cwd: parentDir });
      } else {
        fileList.push({ path: baseName, cwd: parentDir });
      }
    }

    // Create the tar stream with the first input's parent as cwd
    // We need to handle multiple cwds, so we'll use a different approach
    
    return new Promise(async (resolve, reject) => {
      const outputStream = fs.createWriteStream(output);
      
      outputStream.on('error', reject);
      
      let lastReportedSize = 0;
      const reportProgress = () => {
        try {
          const stats = fs.statSync(output);
          const delta = stats.size - lastReportedSize;
          if (delta > 0) {
            onProgress(delta);
            lastReportedSize = stats.size;
          }
        } catch {}
      };

      const progressInterval = setInterval(reportProgress, 200);

      const checkCancellation = setInterval(() => {
        if (cancellationToken.cancelled) {
          clearInterval(checkCancellation);
          clearInterval(progressInterval);
          outputStream.destroy();
          reject(new Error('Task cancelled'));
        }
      }, 100);

      try {
        // Process each input
        for (const input of inputs) {
          if (cancellationToken.cancelled) break;
          
          const parentDir = path.dirname(input);
          const baseName = path.basename(input);
          
          await tar.create(
            {
              gzip: gzip,
              file: output,
              cwd: parentDir,
              portable: true,
            },
            [baseName]
          );
        }

        clearInterval(checkCancellation);
        clearInterval(progressInterval);
        reportProgress(); // Final progress update
        resolve();
      } catch (err) {
        clearInterval(checkCancellation);
        clearInterval(progressInterval);
        reject(err);
      }
    });
  }

  private getSize(filePath: string): number {
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      return stats.size;
    }
    
    let totalSize = 0;
    try {
      const files = fs.readdirSync(filePath);
      for (const file of files) {
        totalSize += this.getSize(path.join(filePath, file));
      }
    } catch {
      // Ignore permission errors
    }
    return totalSize;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
