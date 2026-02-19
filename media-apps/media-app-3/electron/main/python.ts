import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import path from 'path'

let pythonProcess: ChildProcess | null = null
export const PORT = 7899

export function startPythonBackend(): Promise<void> {
  if (pythonProcess) return Promise.resolve()

  return new Promise((resolve) => {
    const backendDir = path.join(app.getAppPath(), 'backend')
    const pythonBin =
      process.platform === 'win32'
        ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
        : path.join(backendDir, '.venv', 'bin', 'python')

    pythonProcess = spawn(pythonBin, ['-m', 'uvicorn', 'main:app', '--port', String(PORT), '--host', '127.0.0.1'], {
      cwd: backendDir
    })

    let resolved = false

    const settle = (): void => {
      if (resolved) return
      resolved = true
      pythonProcess?.stdout?.removeListener('data', onReady)
      pythonProcess?.stderr?.removeListener('data', onReady)
      resolve()
    }

    const onReady = (data: Buffer): void => {
      if (data.toString().includes('Application startup complete')) {
        settle()
      }
    }

    pythonProcess.stdout?.on('data', onReady)
    pythonProcess.stderr?.on('data', onReady)
    pythonProcess.on('error', (err) => {
      console.error('Python backend failed to start:', err)
      settle() // resolve anyway so Electron window still opens
    })

    // Fallback: resolve after 8 seconds regardless
    setTimeout(() => settle(), 8000)
  })
}

export function stopPythonBackend(): void {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}
