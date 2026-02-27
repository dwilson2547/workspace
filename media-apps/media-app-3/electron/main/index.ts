import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { startPythonBackend, stopPythonBackend } from './python'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  })

  const scriptSrc = is.dev ? "'self' 'unsafe-inline'" : "'self'"
  const csp = `default-src 'self'; connect-src 'self' http://127.0.0.1:7899 http://localhost:7899 ws://127.0.0.1:7899 ws://localhost:7899; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' http://127.0.0.1:7899 data:`
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ?? {}
    delete responseHeaders['content-security-policy']
    delete responseHeaders['Content-Security-Policy']
    callback({
      responseHeaders: {
        ...responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = new URL(details.url)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app
  .whenReady()
  .then(async () => {
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ipcMain.handle('select-folder', async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const opts = { properties: ['openDirectory' as const] }
      const result = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts)
      return result.filePaths[0] ?? null
    })

    ipcMain.handle('select-files', async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const opts = { properties: ['openFile' as const, 'multiSelections' as const] }
      const result = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts)
      return result.filePaths
    })

    await startPythonBackend()
    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  .catch((error) => {
    console.error('Failed to initialize app:', error)
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => stopPythonBackend())
