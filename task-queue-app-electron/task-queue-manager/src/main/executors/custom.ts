import { spawn, ChildProcess } from 'child_process';
import { CustomTaskConfig } from '../../shared/types';
import { TaskExecutor, ProgressCallback, CancellationToken, ExecutorResult, killProcessTree } from './base';

export class CustomExecutor implements TaskExecutor<CustomTaskConfig> {
  validate(config: CustomTaskConfig): { valid: boolean; error?: string } {
    if (!config.command || config.command.trim() === '') {
      return { valid: false, error: 'Command is required' };
    }
    return { valid: true };
  }

  async execute(
    config: CustomTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    const validation = this.validate(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    onProgress({ progress: 0, message: `Running: ${config.command}` });

    try {
      return await this.runCommand(config, onProgress, cancellationToken);
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  private runCommand(
    config: CustomTaskConfig,
    onProgress: ProgressCallback,
    cancellationToken: CancellationToken
  ): Promise<ExecutorResult> {
    return new Promise((resolve) => {
      let proc: ChildProcess;

      // Build environment
      const env = {
        ...process.env,
        ...config.env,
      };

      // Spawn options
      const options: any = {
        detached: true,
        env,
      };

      if (config.cwd) {
        options.cwd = config.cwd;
      }

      // Use shell mode if requested or if command contains shell characters
      const useShell = config.shell ?? this.needsShell(config.command);
      
      if (useShell) {
        options.shell = true;
        const fullCommand = config.args && config.args.length > 0 
          ? `${config.command} ${config.args.join(' ')}`
          : config.command;
        proc = spawn(fullCommand, [], options);
      } else {
        proc = spawn(config.command, config.args || [], options);
      }

      let stdout = '';
      let stderr = '';
      let lineCount = 0;

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        
        // Count lines for progress indication
        const newLines = (text.match(/\n/g) || []).length;
        lineCount += newLines;
        
        // Show last line of output
        const lines = text.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        
        // Try to extract percentage from output
        const percentMatch = lastLine.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1]);
          onProgress({ progress: Math.min(percent, 99), message: lastLine.substring(0, 100) });
        } else {
          // Indeterminate progress - show output
          onProgress({ 
            progress: Math.min(50 + (lineCount % 40), 90), 
            message: lastLine.substring(0, 100) 
          });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        
        // Some programs output progress to stderr
        const text = data.toString();
        const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1]);
          const lines = text.trim().split('\n');
          onProgress({ 
            progress: Math.min(percent, 99), 
            message: lines[lines.length - 1].substring(0, 100) 
          });
        }
      });

      const checkCancellation = setInterval(() => {
        if (cancellationToken.cancelled) {
          clearInterval(checkCancellation);
          killProcessTree(proc);
          resolve({ success: false, error: 'Task cancelled' });
        }
      }, 100);

      proc.on('close', (code, signal) => {
        clearInterval(checkCancellation);
        if (cancellationToken.cancelled) return;

        if (code === 0) {
          onProgress({ progress: 100, message: 'Command completed' });
          resolve({ success: true });
        } else if (signal) {
          resolve({ success: false, error: `Process killed with signal ${signal}` });
        } else {
          // Include stderr in error message
          const errorOutput = stderr.trim() || stdout.trim();
          const errorLines = errorOutput.split('\n').slice(-5).join('\n');
          resolve({ 
            success: false, 
            error: `Command exited with code ${code}${errorLines ? `:\n${errorLines}` : ''}` 
          });
        }
      });

      proc.on('error', (err) => {
        clearInterval(checkCancellation);
        resolve({ success: false, error: err.message });
      });
    });
  }

  private needsShell(command: string): boolean {
    // Check if command contains shell-specific characters
    const shellChars = ['|', '>', '<', '&', ';', '$', '`', '(', ')', '{', '}', '*', '?', '[', ']', '!', '~'];
    return shellChars.some(char => command.includes(char));
  }
}
