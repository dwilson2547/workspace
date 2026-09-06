import React from 'react';
import { Settings as SettingsIcon, Info, ExternalLink, FolderOpen, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const [ffmpegInstalled, setFfmpegInstalled] = React.useState<boolean | null>(null);
  const [rsyncInstalled, setRsyncInstalled] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Check if FFmpeg is installed
    window.electronAPI?.app?.getVersion?.().then(() => {
      // Just a placeholder - in real app we'd check for tool availability
    });
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="text-gray-400 mt-1">Configure Task Queue Manager</p>
      </div>

      {/* About Section */}
      <section className="bg-surface-dark border border-surface-light rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Info className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-100">About</h2>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-gray-200">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Electron</span>
            <span className="text-gray-200">{process.versions?.electron || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Node.js</span>
            <span className="text-gray-200">{process.versions?.node || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Chrome</span>
            <span className="text-gray-200">{process.versions?.chrome || 'N/A'}</span>
          </div>
        </div>
      </section>

      {/* Dependencies Section */}
      <section className="bg-surface-dark border border-surface-light rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-100">System Dependencies</h2>
        </div>
        
        <p className="text-sm text-gray-400 mb-4">
          Some task types require external tools to be installed on your system.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-darker rounded-xl">
            <div>
              <h3 className="font-medium text-gray-200">FFmpeg</h3>
              <p className="text-sm text-gray-500">Required for video transcoding tasks</p>
            </div>
            <a
              href="https://ffmpeg.org/download.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-light hover:bg-surface-lighter rounded-lg text-sm text-cyan-400 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Install
            </a>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-darker rounded-xl">
            <div>
              <h3 className="font-medium text-gray-200">rsync</h3>
              <p className="text-sm text-gray-500">Required for rsync tasks and copy fallback on Unix</p>
            </div>
            <div className="text-sm text-gray-400">
              {process.platform === 'win32' ? 'Not available on Windows' : 'Usually pre-installed'}
            </div>
          </div>
        </div>
      </section>

      {/* Data Section */}
      <section className="bg-surface-dark border border-surface-light rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <FolderOpen className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-100">Data Storage</h2>
        </div>
        
        <p className="text-sm text-gray-400 mb-4">
          Task Queue Manager stores its data locally on your computer.
        </p>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-surface-darker rounded-lg">
            <span className="text-gray-400">Database</span>
            <code className="text-gray-300 text-xs bg-surface-light px-2 py-1 rounded">
              ~/.task-queue-manager/database.sqlite
            </code>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface-darker rounded-lg">
            <span className="text-gray-400">Logs</span>
            <code className="text-gray-300 text-xs bg-surface-light px-2 py-1 rounded">
              ~/.task-queue-manager/logs/
            </code>
          </div>
        </div>
      </section>

      {/* Tips Section */}
      <section className="bg-surface-dark border border-surface-light rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <SettingsIcon className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-100">Usage Tips</h2>
        </div>
        
        <ul className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span>
            <span>Queues are created in a paused state by default. Add tasks, then start the queue.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span>
            <span>Pausing a queue will let the current task finish before stopping.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span>
            <span>Workflows preserve tasks after completion - use Reset to run them again.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span>
            <span>Task queues automatically remove completed tasks.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span>
            <span>The app handles system sleep/wake automatically - tasks continue when you wake up.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-cyan-400">•</span>
            <span>Use Custom tasks to run any shell command with progress tracking.</span>
          </li>
        </ul>
      </section>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        <p>Task Queue Manager - Built with Electron + React</p>
      </div>
    </div>
  );
}
