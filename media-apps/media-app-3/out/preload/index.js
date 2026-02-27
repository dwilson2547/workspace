"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => electron.ipcRenderer.invoke("select-folder"),
  selectFiles: () => electron.ipcRenderer.invoke("select-files")
});
