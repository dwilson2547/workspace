import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IPC_CHANNELS, DEPENDENCIES, Dependency } from '@tqm/shared';

const execAsync = promisify(exec);

interface DependencyCheckResult {
  name: string;
  available: boolean;
  version?: string;
  error?: string;
}

async function checkDependency(dep: Dependency): Promise<DependencyCheckResult> {
  try {
    const { stdout } = await execAsync(dep.checkCommand, { timeout: 5000 });

    // Extract version from output
    let version: string | undefined;

    if (dep.binary === 'ffmpeg') {
      const match = stdout.match(/ffmpeg version (\S+)/);
      version = match?.[1];
    } else if (dep.binary === 'rsync') {
      const match = stdout.match(/rsync\s+version\s+(\S+)/);
      version = match?.[1];
    } else if (dep.binary === 'rclone') {
      const match = stdout.match(/rclone v(\S+)/);
      version = match?.[1];
    } else if (dep.binary === 'pigz') {
      const match = stdout.match(/pigz (\S+)/);
      version = match?.[1];
    } else if (dep.binary === 'magick') {
      const match = stdout.match(/ImageMagick (\S+)/);
      version = match?.[1];
    } else if (dep.binary === 'exiftool') {
      version = stdout.trim();
    }

    return {
      name: dep.name,
      available: true,
      version,
    };
  } catch (error) {
    return {
      name: dep.name,
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INVOKE.CHECK_DEPENDENCIES, async () => {
    const results = await Promise.all(
      DEPENDENCIES.map(async (dep) => {
        const result = await checkDependency(dep);
        return {
          ...dep,
          available: result.available,
          version: result.version,
        };
      })
    );
    return results;
  });
}
