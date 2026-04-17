"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Task CRUD
  getTasks: () => electron.ipcRenderer.invoke("tasks:getAll"),
  addTask: (task) => electron.ipcRenderer.invoke("tasks:add", task),
  updateTask: (id, data) => electron.ipcRenderer.invoke("tasks:update", id, data),
  deleteTask: (id) => electron.ipcRenderer.invoke("tasks:delete", id),
  // Sync control
  startSync: (taskId) => electron.ipcRenderer.invoke("sync:start", taskId),
  stopSync: (taskId) => electron.ipcRenderer.invoke("sync:stop", taskId),
  // Native dialog
  openFolder: () => electron.ipcRenderer.invoke("dialog:openFolder"),
  // Remotes
  listRemotes: () => electron.ipcRenderer.invoke("remotes:list"),
  // Logs
  readTaskLog: (taskId) => electron.ipcRenderer.invoke("logs:read", taskId),
  // Push event subscriptions (main → renderer)
  onStarted: (cb) => {
    electron.ipcRenderer.on("sync:started", (_event, data) => cb(data));
  },
  onProgress: (cb) => {
    electron.ipcRenderer.on("sync:progress", (_event, data) => cb(data));
  },
  onComplete: (cb) => {
    electron.ipcRenderer.on("sync:complete", (_event, data) => cb(data));
  },
  onError: (cb) => {
    electron.ipcRenderer.on("sync:error", (_event, data) => cb(data));
  },
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  }
});
