import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import path from 'path'

let pythonProcess: ChildProcess | null = null
export const PORT = 7899

function getBackendDir(): string {
  // In packaged builds, backend lives in resources/ outside the asar.
  // In dev mode, use __dirname-relative path so this works regardless of
  // whether Electron is launched via `electron .` or `electron out/main/index.js`.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend')
  }
  // __dirname = out/main/ → ../../backend = project root / backend
  return path.resolve(__dirname, '../../backend')
}

function killProcessOnPort(port: number): void {
  try {
    const { execSync } = require('child_process')
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      const pids = [...new Set(result.trim().split('\n').map((l: string) => l.trim().split(/\s+/).pop()).filter(Boolean))]
      pids.forEach((pid: unknown) => { try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }) } catch {} })
    } else {
      execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: 'ignore' })
    }
  } catch {
    // No process on port, or kill failed — proceed regardless
  }
}

export function startPythonBackend(): Promise<void> {
  if (pythonProcess) return Promise.resolve()
  killProcessOnPort(PORT)

  return new Promise((resolve) => {
    const backendDir = getBackendDir()
    const pythonBin =
      process.platform === 'win32'
        ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
        : path.join(backendDir, '.venv', 'bin', 'python')

    console.log(`[python] backendDir: ${backendDir}`)
    console.log(`[python] pythonBin:  ${pythonBin}`)

    pythonProcess = spawn(pythonBin, ['-m', 'uvicorn', 'main:app', '--port', String(PORT), '--host', '127.0.0.1'], {
      cwd: backendDir,
      stdio: 'pipe'
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
      const text = data.toString()
      process.stdout.write(`[backend] ${text}`)
      if (text.includes('Application startup complete')) {
        console.log('[python] Backend is ready')
        settle()
      }
    }

    pythonProcess.stdout?.on('data', onReady)
    pythonProcess.stderr?.on('data', onReady)

    pythonProcess.on('error', (err) => {
      console.error('[python] Spawn error:', err.message)
      settle()
    })

    pythonProcess.on('exit', (code, signal) => {
      if (!resolved) {
        console.error(`[python] Backend exited before startup (code=${code}, signal=${signal})`)
        settle()
      }
      pythonProcess = null
    })

    // Fallback: resolve after 15 seconds regardless
    setTimeout(() => {
      if (!resolved) console.warn('[python] Backend startup timed out after 15s')
      settle()
    }, 15000)
  })
}

export function stopPythonBackend(): void {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}
