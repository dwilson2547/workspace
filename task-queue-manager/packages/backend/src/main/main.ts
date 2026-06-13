import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from '../db';
import { registerAllHandlers } from '../handlers';
import { setMainWindow, getMainWindow } from './events';

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // Show when ready to avoid flash
  });

  // Store reference for event emission
  setMainWindow(mainWindow);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load frontend
  if (process.env.NODE_ENV === 'development') {
    // Load from Vite dev server
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Load from built files
    await mainWindow.loadFile(path.join(__dirname, '../../frontend/index.html'));
  }

  mainWindow.on('closed', () => {
    setMainWindow(null);
  });
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Get platform-specific app data path
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'task_queue.db');

  console.log(`Database path: ${dbPath}`);

  // Initialize database
  initDatabase(dbPath);

  // Register IPC handlers
  registerAllHandlers(getMainWindow);

  // Create window when ready
  await app.whenReady();
  await createWindow();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quitting
app.on('before-quit', () => {
  closeDatabase();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Start the application
init().catch((error) => {
  console.error('Failed to initialize application:', error);
  app.quit();
});
