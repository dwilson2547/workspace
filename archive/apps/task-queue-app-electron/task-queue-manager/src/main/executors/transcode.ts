import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { TranscodeTaskConfig } from '../../shared/types';
import { TaskExecutor, ProgressCallback, CancellationToken, ExecutorResult, killProcessTree } from './base';

export class TranscodeExecutor implements TaskExecutor<TranscodeTaskConfig> {
  validate(config: TranscodeTaskConfig): { valid: boolean; error?: string } {
    if (!config.input) {
      return { valid: false, error: 'Input file is required' };
    }
    if (!config.output) {
      return { valid: false, error: 'Output path is required' };
    }
    if (!fs.existsSync(config.input)) {
      return { valid: false, error: `Input file does not exist: ${config.input}` };
    }
    return { valid: true };
  }

  async execute(
    config: TranscodeTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const validation = this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check if ffmpeg is available
    const ffmpegPath = await this.findFFmpeg();
    if (!ffmpegPath) {
      return { success: false, error: 'FFmpeg not found. Please install FFmpeg and ensure it is in your PATH.' };
    }

    onProgress({ progress: 0, message: 'Analyzing input file...' });

    try {
      // Get duration for progress calculation
      const duration = await this.getDuration(ffmpegPath, config.input);
      
      // Ensure output directory exists
      const outputDir = path.dirname(config.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Build FFmpeg arguments
      const args = this.buildFFmpegArgs(config);
      
      return await this.runFFmpeg(ffmpegPath, args, duration, onProgress, cancellationToken);
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  private async findFFmpeg(): Promise<string | null> {
    const possiblePaths = process.platform === 'win32' 
      ? ['ffmpeg.exe', 'C:\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe']
      : ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg'];

    for (const ffmpegPath of possiblePaths) {
      try {
        const { execSync } = require('child_process');
        execSync(`"${ffmpegPath}" -version`, { stdio: 'ignore' });
        return ffmpegPath;
      } catch {
        continue;
      }
    }

    // Try finding in PATH
    try {
      const { execSync } = require('child_process');
      const which = process.platform === 'win32' ? 'where' : 'which';
      const result = execSync(`${which} ffmpeg`, { encoding: 'utf8' });
      return result.trim().split('\n')[0];
    } catch {
      return null;
    }
  }

  private async getDuration(ffmpegPath: string, input: string): Promise<number> {
    return new Promise((resolve) => {
      const ffprobe = ffmpegPath.replace('ffmpeg', 'ffprobe');
      const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', input];
      
      const proc = spawn(ffprobe, args);
      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      });

      proc.on('error', () => {
        resolve(0);
      });
    });
  }

  private buildFFmpegArgs(config: TranscodeTaskConfig): string[] {
    const args: string[] = ['-y', '-i', config.input];

    // Add custom arguments if provided
    if (config.customArgs && config.customArgs.length > 0) {
      args.push(...config.customArgs);
    } else {
      // Apply preset if specified
      if (config.preset) {
        args.push('-preset', config.preset);
      }

      // Video codec
      if (config.videoCodec) {
        if (config.videoCodec === 'copy') {
          args.push('-c:v', 'copy');
        } else {
          args.push('-c:v', config.videoCodec);
        }
      }

      // Audio codec
      if (config.audioCodec) {
        if (config.audioCodec === 'copy') {
          args.push('-c:a', 'copy');
        } else {
          args.push('-c:a', config.audioCodec);
        }
      }

      // Resolution
      if (config.resolution) {
        args.push('-s', config.resolution);
      }

      // Bitrate
      if (config.bitrate) {
        args.push('-b:v', config.bitrate);
      }
    }

    // Progress reporting
    args.push('-progress', 'pipe:1', '-nostats');

    // Output
    args.push(config.output);

    return args;
  }

  private runFFmpeg(
    ffmpegPath: string,
    args: string[],
    duration: number,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    return new Promise((resolve) => {
      const proc = spawn(ffmpegPath, args, { detached: true });
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        
        // Parse progress from FFmpeg output
        const timeMatch = output.match(/out_time_ms=(\d+)/);
        if (timeMatch && duration > 0) {
          const currentMs = parseInt(timeMatch[1], 10);
          const currentSec = currentMs / 1000000;
          const percent = Math.round((currentSec / duration) * 100);
          onProgress({ 
            progress: Math.min(percent, 99), 
            message: `Transcoding... ${this.formatTime(currentSec)} / ${this.formatTime(duration)}` 
          });
        }

        // Check for completion
        if (output.includes('progress=end')) {
          onProgress({ progress: 99, message: 'Finalizing...' });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const checkCancellation = setInterval(() => {
        if (cancellationToken.cancelled) {
          clearInterval(checkCancellation);
          killProcessTree(proc);
          // Clean up partial output file
          try { fs.unlinkSync(args[args.length - 1]); } catch {}
          resolve({ success: false, error: 'Task cancelled' });
        }
      }, 100);

      proc.on('close', (code) => {
        clearInterval(checkCancellation);
        if (cancellationToken.cancelled) return;

        if (code === 0) {
          onProgress({ progress: 100, message: 'Transcode complete' });
          resolve({ success: true });
        } else {
          // Extract meaningful error from stderr
          const errorLines = stderr.split('\n').filter(line => 
            line.includes('Error') || line.includes('error') || line.includes('Invalid')
          );
          const errorMsg = errorLines.length > 0 
            ? errorLines.slice(-3).join('\n') 
            : `FFmpeg exited with code ${code}`;
          resolve({ success: false, error: errorMsg });
        }
      });

      proc.on('error', (err) => {
        clearInterval(checkCancellation);
        resolve({ success: false, error: err.message });
      });
    });
  }

  private formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
