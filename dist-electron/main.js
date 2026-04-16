"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const child_process = require("child_process");
const activeProcesses = /* @__PURE__ */ new Map();
function startSync(taskId, task, win) {
  var _a, _b;
  if (isRunning(taskId)) return;
  const args = [
    task.type,
    // 'sync' or 'copy'
    task.source,
    task.destination,
    "--progress",
    "--stats=1s",
    "--use-json-log",
    "--verbose"
  ];
  const proc = child_process.spawn("rclone", args, { stdio: ["ignore", "pipe", "pipe"] });
  activeProcesses.set(taskId, proc);
  let stdoutBuffer = "";
  let stderrBuffer = "";
  function handleChunk(buffer, chunk) {
    buffer.value += chunk.toString();
    const lines = buffer.value.split("\n");
    buffer.value = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        const payload = {
          taskId,
          stats: obj.stats ?? null,
          log: obj
        };
        win.webContents.send("sync:progress", payload);
      } catch {
      }
    }
  }
  const stdoutBuf = { value: stdoutBuffer };
  const stderrBuf = { value: stderrBuffer };
  (_a = proc.stdout) == null ? void 0 : _a.on("data", (chunk) => handleChunk(stdoutBuf, chunk));
  (_b = proc.stderr) == null ? void 0 : _b.on("data", (chunk) => handleChunk(stderrBuf, chunk));
  proc.on("close", (code) => {
    activeProcesses.delete(taskId);
    if (code === 0) {
      win.webContents.send("sync:complete", { taskId });
    } else {
      win.webContents.send("sync:error", {
        taskId,
        message: `rclone exited with code ${code}`
      });
    }
  });
  proc.on("error", (err) => {
    activeProcesses.delete(taskId);
    win.webContents.send("sync:error", { taskId, message: err.message });
  });
}
function stopSync(taskId) {
  const proc = activeProcesses.get(taskId);
  if (proc) {
    proc.kill("SIGTERM");
    activeProcesses.delete(taskId);
  }
}
function killAll() {
  for (const [, proc] of activeProcesses) {
    proc.kill("SIGTERM");
  }
  activeProcesses.clear();
}
function isRunning(taskId) {
  return activeProcesses.has(taskId);
}
function getTasksPath() {
  return path.join(electron.app.getPath("userData"), "tasks.json");
}
function loadTasks() {
  const p = getTasksPath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
    return raw.map((t) => ({ ...t, status: "idle" }));
  } catch {
    return [];
  }
}
function saveTasks(tasks) {
  fs.writeFileSync(getTasksPath(), JSON.stringify(tasks, null, 2), "utf-8");
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 700,
    minWidth: 720,
    minHeight: 500,
    title: "OpenSync",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
function registerIpcHandlers() {
  electron.ipcMain.handle("tasks:getAll", () => loadTasks());
  electron.ipcMain.handle("tasks:add", (_, taskData) => {
    const tasks = loadTasks();
    const newTask = {
      ...taskData,
      id: crypto.randomUUID(),
      status: "idle"
    };
    tasks.push(newTask);
    saveTasks(tasks);
    return newTask;
  });
  electron.ipcMain.handle("tasks:update", (_, id, data) => {
    const tasks = loadTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...data };
      saveTasks(tasks);
    }
  });
  electron.ipcMain.handle("tasks:delete", (_, id) => {
    const tasks = loadTasks().filter((t) => t.id !== id);
    saveTasks(tasks);
  });
  electron.ipcMain.handle("sync:start", (_, taskId) => {
    if (!mainWindow) return;
    if (isRunning(taskId)) return;
    const task = loadTasks().find((t) => t.id === taskId);
    if (!task) return;
    startSync(taskId, task, mainWindow);
  });
  electron.ipcMain.handle("sync:stop", (_, taskId) => {
    stopSync(taskId);
  });
  electron.ipcMain.handle("dialog:openFolder", async () => {
    if (!mainWindow) return null;
    const result = await electron.dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"]
    });
    return result.filePaths[0] ?? null;
  });
}
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("before-quit", () => {
  killAll();
});
