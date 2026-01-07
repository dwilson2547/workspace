import { app, BrowserWindow, powerMonitor, nativeTheme } from 'electron';
import * as path from 'path';
import { initDatabase, closeDatabase } from './database';
import { setupIpcHandlers } from './ipc-handlers';
import { queueService } from './services/queue-service';

let mainWindow: BrowserWindow | null = null;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function createWindow(): Promise<void> {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Performance optimizations
      backgroundThrottling: false, // Don't throttle when in background
    },
    show: false, // Don't show until ready
  });

  // Set up queue service with main window
  queueService.setMainWindow(mainWindow);

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  if (isDev) {
    // In development, load from Vite dev server
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    queueService.setMainWindow(null);
  });
}

// Initialize the app
app.whenReady().then(async () => {
  // Initialize database
  initDatabase();

  // Set up IPC handlers
  setupIpcHandlers();

  // Create the main window
  await createWindow();

  // Handle power events for sleep/wake
  powerMonitor.on('suspend', () => {
    console.log('System suspending...');
    queueService.handleSystemSleep();
  });

  powerMonitor.on('resume', () => {
    console.log('System resuming...');
    queueService.handleSystemWake();
  });

  // Handle lock screen (also pause on lock for security)
  powerMonitor.on('lock-screen', () => {
    console.log('Screen locked');
    // Optionally pause queues when screen is locked
  });

  powerMonitor.on('unlock-screen', () => {
    console.log('Screen unlocked');
    // Optionally resume queues when screen is unlocked
  });

  // macOS: Re-create window when clicking dock icon
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up on quit
app.on('before-quit', () => {
  closeDatabase();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
