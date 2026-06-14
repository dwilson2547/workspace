import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import archiver from 'archiver';
import extract from 'extract-zip';
import tar from 'tar';
import { Client as FtpClient } from 'basic-ftp';
import SftpClient from 'ssh2-sftp-client';
import type { Task } from '../src/shared/types';

const parseArgs = (value?: string) => {
  if (!value) {
    return [] as string[];
  }
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g);
  if (!matches) {
    return [] as string[];
  }
  return matches.map((item) => item.replace(/^"|"$/g, ''));
};

const runCommand = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with code ${code}: ${stderr.trim() || 'Unknown error'}`));
    });
  });

const ensureDestination = (destinationPath?: string, label = 'destination') => {
  if (!destinationPath) {
    throw new Error(`Task missing ${label} path`);
  }
  return destinationPath;
};

const resolveArchiveFormat = (sourcePath: string, format?: string) => {
  if (format) {
    return format as 'zip' | 'tar' | 'tar.gz';
  }
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    return 'tar.gz';
  }
  if (lower.endsWith('.tar')) {
    return 'tar';
  }
  return 'zip';
};

const createArchive = async (sourcePath: string, destinationPath: string, format: 'zip' | 'tar' | 'tar.gz') => {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  const output = fsSync.createWriteStream(destinationPath);
  const archive = format === 'zip'
    ? archiver('zip', { zlib: { level: 9 } })
    : archiver('tar', format === 'tar.gz' ? { gzip: true, gzipOptions: { level: 9 } } : undefined);

  return new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    output.on('error', (error) => reject(error));
    archive.on('error', (error) => reject(error));
    archive.pipe(output);

    fsSync.stat(sourcePath, (statError, stats) => {
      if (statError) {
        reject(statError);
        return;
      }
      if (stats.isDirectory()) {
        archive.directory(sourcePath, false);
      } else {
        archive.file(sourcePath, { name: path.basename(sourcePath) });
      }
      try {
        archive.finalize();
      } catch (error) {
        reject(error as Error);
      }
    });
  });
};

const extractArchive = async (sourcePath: string, destinationPath: string, format: 'zip' | 'tar' | 'tar.gz') => {
  await fs.mkdir(destinationPath, { recursive: true });
  if (format === 'zip') {
    await extract(sourcePath, { dir: destinationPath });
    return;
  }
  await tar.extract({ file: sourcePath, cwd: destinationPath, gzip: format === 'tar.gz' });
};

const applyRecursively = async (
  targetPath: string,
  handler: (path: string) => Promise<void>,
  recursive: boolean
) => {
  const stats = await fs.lstat(targetPath);
  if (stats.isDirectory() && recursive) {
    const entries = await fs.readdir(targetPath);
    for (const entry of entries) {
      await applyRecursively(path.join(targetPath, entry), handler, recursive);
    }
  }
  await handler(targetPath);
};

const parseNumericId = (value?: string, label = 'id') => {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
};

const resolveRemotePath = (remotePath: string, fileName: string) => {
  if (!remotePath) {
    return fileName;
  }
  if (remotePath.endsWith('/') || remotePath.endsWith('\\')) {
    return `${remotePath}${fileName}`;
  }
  return remotePath;
};

const transferFtp = async (task: Task) => {
  const {
    ftpHost,
    ftpPort,
    ftpUsername,
    ftpPassword,
    ftpRemotePath,
    ftpDirection,
    ftpSecure,
    destinationPath
  } = task.config;
  if (!ftpHost || !ftpUsername || !ftpPassword || !ftpRemotePath) {
    throw new Error('FTP task missing connection details or remote path');
  }
  const client = new FtpClient();
  await client.access({
    host: ftpHost,
    port: ftpPort ?? 21,
    user: ftpUsername,
    password: ftpPassword,
    secure: ftpSecure ?? false
  });

  try {
    if (ftpDirection === 'download') {
      const target = ensureDestination(destinationPath, 'local destination');
      await client.downloadTo(target, ftpRemotePath);
      return;
    }
    const localPath = task.config.sourcePath;
    const remoteTarget = resolveRemotePath(ftpRemotePath, path.basename(localPath));
    const stats = await fs.lstat(localPath);
    if (stats.isDirectory()) {
      await client.uploadFromDir(localPath, remoteTarget);
    } else {
      await client.uploadFrom(localPath, remoteTarget);
    }
  } finally {
    client.close();
  }
};

const transferSftp = async (task: Task) => {
  const {
    sftpHost,
    sftpPort,
    sftpUsername,
    sftpPassword,
    sftpRemotePath,
    sftpDirection,
    destinationPath
  } = task.config;
  if (!sftpHost || !sftpUsername || !sftpPassword || !sftpRemotePath) {
    throw new Error('SFTP task missing connection details or remote path');
  }
  const client = new SftpClient();
  await client.connect({
    host: sftpHost,
    port: sftpPort ?? 22,
    username: sftpUsername,
    password: sftpPassword
  });

  try {
    if (sftpDirection === 'download') {
      const target = ensureDestination(destinationPath, 'local destination');
      await client.fastGet(sftpRemotePath, target);
      return;
    }
    const localPath = task.config.sourcePath;
    const remoteTarget = resolveRemotePath(sftpRemotePath, path.basename(localPath));
    const stats = await fs.lstat(localPath);
    if (stats.isDirectory()) {
      await client.uploadDir(localPath, remoteTarget);
    } else {
      await client.fastPut(localPath, remoteTarget);
    }
  } finally {
    await client.end();
  }
};

export const runTask = async (task: Task) => {
  switch (task.type) {
    case 'copy': {
      const destinationPath = ensureDestination(task.config.destinationPath, 'destination');
      await fs.copyFile(task.config.sourcePath, destinationPath);
      break;
    }
    case 'move': {
      const destinationPath = ensureDestination(task.config.destinationPath, 'destination');
      await fs.rename(task.config.sourcePath, destinationPath);
      break;
    }
    case 'delete':
      await fs.rm(task.config.sourcePath, { force: true, recursive: true });
      break;
    case 'rsync': {
      const destinationPath = ensureDestination(task.config.destinationPath, 'destination');
      const args = [...parseArgs(task.config.rsyncArgs), task.config.sourcePath, destinationPath];
      await runCommand('rsync', args);
      break;
    }
    case 'ffmpeg': {
      const destinationPath = ensureDestination(task.config.destinationPath, 'output');
      const codecArgs = task.config.ffmpegCodec ? ['-c:v', task.config.ffmpegCodec] : [];
      const cqArgs =
        typeof task.config.ffmpegCq === 'number' && !Number.isNaN(task.config.ffmpegCq)
          ? ['-cq:v', String(task.config.ffmpegCq)]
          : [];
      const args = [
        '-y',
        '-i',
        task.config.sourcePath,
        ...codecArgs,
        ...cqArgs,
        ...parseArgs(task.config.ffmpegArgs),
        destinationPath
      ];
      await runCommand('ffmpeg', args);
      break;
    }
    case 'archiveCreate': {
      const destinationPath = ensureDestination(task.config.destinationPath, 'archive destination');
      const format = resolveArchiveFormat(destinationPath, task.config.archiveFormat);
      await createArchive(task.config.sourcePath, destinationPath, format);
      break;
    }
    case 'archiveExtract': {
      const destinationPath = ensureDestination(task.config.destinationPath, 'extract destination');
      const format = resolveArchiveFormat(task.config.sourcePath, task.config.archiveFormat);
      await extractArchive(task.config.sourcePath, destinationPath, format);
      break;
    }
    case 'chmod': {
      const mode = task.config.chmodMode;
      if (!mode) {
        throw new Error('chmod task missing mode');
      }
      await applyRecursively(
        task.config.sourcePath,
        async (target) => fs.chmod(target, mode),
        task.config.chmodRecursive ?? false
      );
      break;
    }
    case 'chown': {
      const uid = parseNumericId(task.config.chownUser, 'user id');
      const gid = parseNumericId(task.config.chownGroup, 'group id');
      await applyRecursively(
        task.config.sourcePath,
        async (target) => fs.chown(target, uid, gid),
        task.config.chownRecursive ?? false
      );
      break;
    }
    case 'ftp':
      await transferFtp(task);
      break;
    case 'sftp':
      await transferSftp(task);
      break;
    default:
      throw new Error(`Unsupported task type: ${task.type}`);
  }
};
