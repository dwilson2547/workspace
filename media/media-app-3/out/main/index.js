"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
let pythonProcess = null;
const PORT = 7899;
function getBackendDir() {
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }
  return path.resolve(__dirname, "../../backend");
}
function killProcessOnPort(port) {
  try {
    const { execSync } = require("child_process");
    if (process.platform === "win32") {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const pids = [...new Set(result.trim().split("\n").map((l) => l.trim().split(/\s+/).pop()).filter(Boolean))];
      pids.forEach((pid) => {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        } catch {
        }
      });
    } else {
      execSync(`lsof -ti :${port} | xargs -r kill -9`, { stdio: "ignore" });
    }
  } catch {
  }
}
function startPythonBackend() {
  if (pythonProcess) return Promise.resolve();
  killProcessOnPort(PORT);
  return new Promise((resolve) => {
    const backendDir = getBackendDir();
    const pythonBin = process.platform === "win32" ? path.join(backendDir, ".venv", "Scripts", "python.exe") : path.join(backendDir, ".venv", "bin", "python");
    console.log(`[python] backendDir: ${backendDir}`);
    console.log(`[python] pythonBin:  ${pythonBin}`);
    pythonProcess = child_process.spawn(pythonBin, ["-m", "uvicorn", "main:app", "--port", String(PORT), "--host", "127.0.0.1"], {
      cwd: backendDir,
      stdio: "pipe"
    });
    let resolved = false;
    const settle = () => {
      if (resolved) return;
      resolved = true;
      pythonProcess?.stdout?.removeListener("data", onReady);
      pythonProcess?.stderr?.removeListener("data", onReady);
      resolve();
    };
    const onReady = (data) => {
      const text = data.toString();
      process.stdout.write(`[backend] ${text}`);
      if (text.includes("Application startup complete")) {
        console.log("[python] Backend is ready");
        settle();
      }
    };
    pythonProcess.stdout?.on("data", onReady);
    pythonProcess.stderr?.on("data", onReady);
    pythonProcess.on("error", (err) => {
      console.error("[python] Spawn error:", err.message);
      settle();
    });
    pythonProcess.on("exit", (code, signal) => {
      if (!resolved) {
        console.error(`[python] Backend exited before startup (code=${code}, signal=${signal})`);
        settle();
      }
      pythonProcess = null;
    });
    setTimeout(() => {
      if (!resolved) console.warn("[python] Backend startup timed out after 15s");
      settle();
    }, 15e3);
  });
}
function stopPythonBackend() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true
    }
  });
  const scriptSrc = is.dev ? "'self' 'unsafe-inline'" : "'self'";
  const csp = `default-src 'self'; connect-src 'self' http://127.0.0.1:7899 http://localhost:7899 ws://127.0.0.1:7899 ws://localhost:7899; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' http://127.0.0.1:7899 data:`;
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ?? {};
    delete responseHeaders["content-security-policy"];
    delete responseHeaders["Content-Security-Policy"];
    callback({
      responseHeaders: {
        ...responseHeaders,
        "Content-Security-Policy": [csp]
      }
    });
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    const url = new URL(details.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
      electron.shell.openExternal(details.url);
    }
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(async () => {
  electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  electron.ipcMain.handle("select-folder", async (event) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    const opts = { properties: ["openDirectory"] };
    const result = win ? await electron.dialog.showOpenDialog(win, opts) : await electron.dialog.showOpenDialog(opts);
    return result.filePaths[0] ?? null;
  });
  electron.ipcMain.handle("select-files", async (event) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender);
    const opts = { properties: ["openFile", "multiSelections"] };
    const result = win ? await electron.dialog.showOpenDialog(win, opts) : await electron.dialog.showOpenDialog(opts);
    return result.filePaths;
  });
  await startPythonBackend();
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  console.error("Failed to initialize app:", error);
  electron.app.quit();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => stopPythonBackend());
