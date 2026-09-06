import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { ZipTaskConfig } from '../../shared/types';
import { TaskExecutor, ProgressCallback, CancellationToken, ExecutorResult } from './base';

export class ZipExecutor implements TaskExecutor<ZipTaskConfig> {
  validate(config: ZipTaskConfig): { valid: boolean; error?: string } {
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
    config: ZipTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const validation = this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      if (config.zipIndividually) {
        return await this.zipIndividually(config, onProgress, cancellationToken);
      } else {
        return await this.zipTogether(config, onProgress, cancellationToken);
      }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  private async zipTogether(
    config: ZipTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    return new Promise((resolve, reject) => {
      onProgress({ progress: 0, message: 'Preparing archive...' });

      // Ensure output directory exists
      const outputDir = path.dirname(config.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const output = fs.createWriteStream(config.output);
      const archive = archiver('zip', {
        zlib: { level: config.compressionLevel ?? 6 }
      });

      let totalBytes = 0;
      let processedBytes = 0;

      // Calculate total size
      for (const input of config.inputs) {
        totalBytes += this.getSize(input);
      }

      archive.on('progress', (progress) => {
        processedBytes = progress.fs.processedBytes;
        const percent = totalBytes > 0 ? Math.round((processedBytes / totalBytes) * 100) : 0;
        onProgress({ 
          progress: Math.min(percent, 99), 
          message: `Compressing... ${this.formatBytes(processedBytes)} / ${this.formatBytes(totalBytes)}` 
        });
      });

      output.on('close', () => {
        if (cancellationToken.cancelled) {
          // Clean up partial file
          try { fs.unlinkSync(config.output); } catch {}
          resolve({ success: false, error: 'Task cancelled' });
        } else {
          onProgress({ progress: 100, message: 'Archive complete' });
          resolve({ success: true });
        }
      });

      archive.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      archive.pipe(output);

      // Add inputs to archive
      for (const input of config.inputs) {
        if (cancellationToken.cancelled) {
          archive.abort();
          return;
        }

        const stats = fs.statSync(input);
        const name = path.basename(input);

        if (stats.isDirectory()) {
          archive.directory(input, name);
        } else {
          archive.file(input, { name });
        }
      }

      // Check for cancellation periodically
      const checkCancellation = setInterval(() => {
        if (cancellationToken.cancelled) {
          clearInterval(checkCancellation);
          archive.abort();
        }
      }, 100);

      archive.finalize().then(() => {
        clearInterval(checkCancellation);
      }).catch((err) => {
        clearInterval(checkCancellation);
        resolve({ success: false, error: err.message });
      });
    });
  }

  private async zipIndividually(
    config: ZipTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const totalInputs = config.inputs.length;
    const errors: string[] = [];

    // Ensure output directory exists
    if (!fs.existsSync(config.output)) {
      fs.mkdirSync(config.output, { recursive: true });
    }

    for (let i = 0; i < config.inputs.length; i++) {
      if (cancellationToken.cancelled) {
        return { success: false, error: 'Task cancelled' };
      }

      const input = config.inputs[i];
      const baseName = path.basename(input, path.extname(input));
      const outputPath = path.join(config.output, `${baseName}.zip`);

      onProgress({ 
        progress: Math.round((i / totalInputs) * 100), 
        message: `Zipping ${i + 1}/${totalInputs}: ${baseName}` 
      });

      const result = await this.zipSingle(input, outputPath, config.compressionLevel ?? 6, cancellationToken);
      
      if (!result.success) {
        errors.push(`${baseName}: ${result.error}`);
      }
    }

    if (errors.length > 0) {
      return { 
        success: false, 
        error: `Failed to zip ${errors.length} item(s):\n${errors.join('\n')}` 
      };
    }

    onProgress({ progress: 100, message: 'All archives complete' });
    return { success: true };
  }

  private zipSingle(
    input: string,
    output: string,
    compressionLevel: number,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    return new Promise((resolve) => {
      const outputStream = fs.createWriteStream(output);
      const archive = archiver('zip', { zlib: { level: compressionLevel } });

      outputStream.on('close', () => {
        if (cancellationToken.cancelled) {
          try { fs.unlinkSync(output); } catch {}
          resolve({ success: false, error: 'Task cancelled' });
        } else {
          resolve({ success: true });
        }
      });

      archive.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      archive.pipe(outputStream);

      const stats = fs.statSync(input);
      const name = path.basename(input);

      if (stats.isDirectory()) {
        archive.directory(input, name);
      } else {
        archive.file(input, { name });
      }

      archive.finalize();
    });
  }

  private getSize(filePath: string): number {
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      return stats.size;
    }
    
    let totalSize = 0;
    const files = fs.readdirSync(filePath);
    for (const file of files) {
      totalSize += this.getSize(path.join(filePath, file));
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
