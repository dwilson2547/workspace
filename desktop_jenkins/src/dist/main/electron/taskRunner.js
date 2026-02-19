"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTask = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const archiver_1 = __importDefault(require("archiver"));
const extract_zip_1 = __importDefault(require("extract-zip"));
const tar_1 = __importDefault(require("tar"));
const basic_ftp_1 = require("basic-ftp");
const ssh2_sftp_client_1 = __importDefault(require("ssh2-sftp-client"));
const parseArgs = (value) => {
    if (!value) {
        return [];
    }
    const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g);
    if (!matches) {
        return [];
    }
    return matches.map((item) => item.replace(/^"|"$/g, ''));
};
const runCommand = (command, args) => new Promise((resolve, reject) => {
    const child = (0, node_child_process_1.spawn)(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
const ensureDestination = (destinationPath, label = 'destination') => {
    if (!destinationPath) {
        throw new Error(`Task missing ${label} path`);
    }
    return destinationPath;
};
const resolveArchiveFormat = (sourcePath, format) => {
    if (format) {
        return format;
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
const createArchive = async (sourcePath, destinationPath, format) => {
    await promises_1.default.mkdir(node_path_1.default.dirname(destinationPath), { recursive: true });
    const output = node_fs_1.default.createWriteStream(destinationPath);
    const archive = format === 'zip'
        ? (0, archiver_1.default)('zip', { zlib: { level: 9 } })
        : (0, archiver_1.default)('tar', format === 'tar.gz' ? { gzip: true, gzipOptions: { level: 9 } } : undefined);
    return new Promise((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', (error) => reject(error));
        archive.on('error', (error) => reject(error));
        archive.pipe(output);
        node_fs_1.default.stat(sourcePath, (statError, stats) => {
            if (statError) {
                reject(statError);
                return;
            }
            if (stats.isDirectory()) {
                archive.directory(sourcePath, false);
            }
            else {
                archive.file(sourcePath, { name: node_path_1.default.basename(sourcePath) });
            }
            try {
                archive.finalize();
            }
            catch (error) {
                reject(error);
            }
        });
    });
};
const extractArchive = async (sourcePath, destinationPath, format) => {
    await promises_1.default.mkdir(destinationPath, { recursive: true });
    if (format === 'zip') {
        await (0, extract_zip_1.default)(sourcePath, { dir: destinationPath });
        return;
    }
    await tar_1.default.extract({ file: sourcePath, cwd: destinationPath, gzip: format === 'tar.gz' });
};
const applyRecursively = async (targetPath, handler, recursive) => {
    const stats = await promises_1.default.lstat(targetPath);
    if (stats.isDirectory() && recursive) {
        const entries = await promises_1.default.readdir(targetPath);
        for (const entry of entries) {
            await applyRecursively(node_path_1.default.join(targetPath, entry), handler, recursive);
        }
    }
    await handler(targetPath);
};
const parseNumericId = (value, label = 'id') => {
    if (!value) {
        throw new Error(`Missing ${label}`);
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid ${label}: ${value}`);
    }
    return parsed;
};
const resolveRemotePath = (remotePath, fileName) => {
    if (!remotePath) {
        return fileName;
    }
    if (remotePath.endsWith('/') || remotePath.endsWith('\\')) {
        return `${remotePath}${fileName}`;
    }
    return remotePath;
};
const transferFtp = async (task) => {
    const { ftpHost, ftpPort, ftpUsername, ftpPassword, ftpRemotePath, ftpDirection, ftpSecure, destinationPath } = task.config;
    if (!ftpHost || !ftpUsername || !ftpPassword || !ftpRemotePath) {
        throw new Error('FTP task missing connection details or remote path');
    }
    const client = new basic_ftp_1.Client();
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
        const remoteTarget = resolveRemotePath(ftpRemotePath, node_path_1.default.basename(localPath));
        const stats = await promises_1.default.lstat(localPath);
        if (stats.isDirectory()) {
            await client.uploadFromDir(localPath, remoteTarget);
        }
        else {
            await client.uploadFrom(localPath, remoteTarget);
        }
    }
    finally {
        client.close();
    }
};
const transferSftp = async (task) => {
    const { sftpHost, sftpPort, sftpUsername, sftpPassword, sftpRemotePath, sftpDirection, destinationPath } = task.config;
    if (!sftpHost || !sftpUsername || !sftpPassword || !sftpRemotePath) {
        throw new Error('SFTP task missing connection details or remote path');
    }
    const client = new ssh2_sftp_client_1.default();
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
        const remoteTarget = resolveRemotePath(sftpRemotePath, node_path_1.default.basename(localPath));
        const stats = await promises_1.default.lstat(localPath);
        if (stats.isDirectory()) {
            await client.uploadDir(localPath, remoteTarget);
        }
        else {
            await client.fastPut(localPath, remoteTarget);
        }
    }
    finally {
        await client.end();
    }
};
const runTask = async (task) => {
    switch (task.type) {
        case 'copy': {
            const destinationPath = ensureDestination(task.config.destinationPath, 'destination');
            await promises_1.default.copyFile(task.config.sourcePath, destinationPath);
            break;
        }
        case 'move': {
            const destinationPath = ensureDestination(task.config.destinationPath, 'destination');
            await promises_1.default.rename(task.config.sourcePath, destinationPath);
            break;
        }
        case 'delete':
            await promises_1.default.rm(task.config.sourcePath, { force: true, recursive: true });
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
            const cqArgs = typeof task.config.ffmpegCq === 'number' && !Number.isNaN(task.config.ffmpegCq)
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
            await applyRecursively(task.config.sourcePath, async (target) => promises_1.default.chmod(target, mode), task.config.chmodRecursive ?? false);
            break;
        }
        case 'chown': {
            const uid = parseNumericId(task.config.chownUser, 'user id');
            const gid = parseNumericId(task.config.chownGroup, 'group id');
            await applyRecursively(task.config.sourcePath, async (target) => promises_1.default.chown(target, uid, gid), task.config.chownRecursive ?? false);
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
exports.runTask = runTask;
