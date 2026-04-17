"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const child_process = require("child_process");
const os = require("os");
const activeProcesses = /* @__PURE__ */ new Map();
function stripSurroundingQuotes(s) {
  return s.replace(/^(['"])(.*)\1$/, "$2").trim();
}
function shellQuote(s) {
  if (s.startsWith("-")) return s;
  return `"${s}"`;
}
function startSync(taskId, task, win, callbacks, logPath) {
  var _a, _b;
  if (isRunning(taskId)) return;
  const source = stripSurroundingQuotes(task.source);
  const destination = stripSurroundingQuotes(task.destination);
  const filterArgs = (task.filters ?? []).filter((f) => f.value.trim() !== "").map((f) => `--${f.type}=${f.value.trim()}`);
  const args = [
    task.type,
    source,
    destination,
    ...filterArgs,
    "--stats=1s",
    "--use-json-log",
    "--verbose"
  ];
  const proc = child_process.spawn("rclone", args, { stdio: ["ignore", "pipe", "pipe"] });
  activeProcesses.set(taskId, proc);
  const command = `rclone ${args.map(shellQuote).join(" ")}`;
  win.webContents.send("sync:started", { taskId, command });
  let logStream = null;
  if (logPath) {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logStream = fs.createWriteStream(logPath, { flags: "w" });
    logStream.write(JSON.stringify({ level: "info", msg: command, time: (/* @__PURE__ */ new Date()).toISOString() }) + "\n");
  }
  let stdoutBuffer = "";
  let stderrBuffer = "";
  function handleChunk(buffer, chunk) {
    buffer.value += chunk.toString();
    const lines = buffer.value.split("\n");
    buffer.value = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      logStream == null ? void 0 : logStream.write(trimmed + "\n");
      try {
        const obj = JSON.parse(trimmed);
        win.webContents.send("sync:progress", { taskId, stats: obj.stats ?? null, log: obj });
      } catch {
        win.webContents.send("sync:progress", {
          taskId,
          stats: null,
          log: { level: "warning", msg: trimmed, time: (/* @__PURE__ */ new Date()).toISOString() }
        });
      }
    }
  }
  const stdoutBuf = { value: stdoutBuffer };
  const stderrBuf = { value: stderrBuffer };
  (_a = proc.stdout) == null ? void 0 : _a.on("data", (chunk) => handleChunk(stdoutBuf, chunk));
  (_b = proc.stderr) == null ? void 0 : _b.on("data", (chunk) => handleChunk(stderrBuf, chunk));
  proc.on("close", (code) => {
    var _a2, _b2;
    logStream == null ? void 0 : logStream.end();
    activeProcesses.delete(taskId);
    if (code === 0) {
      win.webContents.send("sync:complete", { taskId });
      (_a2 = callbacks == null ? void 0 : callbacks.onComplete) == null ? void 0 : _a2.call(callbacks);
    } else {
      win.webContents.send("sync:error", { taskId, message: `rclone exited with code ${code}` });
      (_b2 = callbacks == null ? void 0 : callbacks.onError) == null ? void 0 : _b2.call(callbacks);
    }
  });
  proc.on("error", (err) => {
    var _a2;
    logStream == null ? void 0 : logStream.end();
    activeProcesses.delete(taskId);
    win.webContents.send("sync:error", { taskId, message: err.message });
    (_a2 = callbacks == null ? void 0 : callbacks.onError) == null ? void 0 : _a2.call(callbacks);
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
function buildRcloneArgs(task) {
  const clean = (s) => s.replace(/^(['"])(.*)\1$/, "$2").trim();
  const filters = (task.filters ?? []).filter((f) => f.value.trim()).map((f) => `--${f.type}=${f.value.trim()}`);
  return [task.type, clean(task.source), clean(task.destination), ...filters];
}
function findRclonePath() {
  const cmd = process.platform === "win32" ? "where" : "which";
  const r = child_process.spawnSync(cmd, ["rclone"], { encoding: "utf-8" });
  if (r.status === 0 && r.stdout.trim()) {
    return r.stdout.trim().split("\n")[0].trim();
  }
  return "rclone";
}
const MARKER = "# opensync:";
function getCrontab() {
  const r = child_process.spawnSync("crontab", ["-l"], { encoding: "utf-8" });
  return r.status === 0 ? r.stdout : "";
}
function setCrontab(content) {
  child_process.spawnSync("crontab", ["-"], { input: content, encoding: "utf-8" });
}
function unixUnregister(taskId) {
  const lines = getCrontab().split("\n").filter((l) => !l.includes(`${MARKER}${taskId}`));
  const content = lines.join("\n").trimEnd();
  setCrontab(content ? content + "\n" : "");
}
function unixRegister(task, logPath) {
  unixUnregister(task.id);
  const rclone = findRclonePath();
  const args = [...buildRcloneArgs(task), "--use-json-log", "--verbose"];
  const quoted = args.map((a) => a.startsWith("--") ? a : `"${a.replace(/"/g, '\\"')}"`).join(" ");
  const logsDir = logPath.substring(0, logPath.lastIndexOf("/"));
  const line = `${task.schedule} mkdir -p "${logsDir}" && "${rclone}" ${quoted} > "${logPath}" 2>&1 ${MARKER}${task.id}`;
  const current = getCrontab().trimEnd();
  setCrontab((current ? current + "\n" : "") + line + "\n");
}
function unixListManagedIds() {
  return getCrontab().split("\n").flatMap((l) => {
    const m = l.match(new RegExp(`${MARKER}([\\w-]+)`));
    return m ? [m[1]] : [];
  });
}
function winTaskName(taskId) {
  return `OpenSync_${taskId}`;
}
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const MONTH_ELEMS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const DOW_ELEMS = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday"
};
function nextStartBoundary(h, m) {
  const d = /* @__PURE__ */ new Date();
  d.setHours(parseInt(h), parseInt(m), 0, 0);
  if (d <= /* @__PURE__ */ new Date()) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 16);
}
function cronToTriggerXml(cron) {
  const [minE, hourE, domE, monthE, dowE] = cron.trim().split(/\s+/);
  if (/^\*\/(\d+)$/.test(minE) && hourE === "*" && domE === "*" && monthE === "*" && dowE === "*") {
    const n = minE.slice(2);
    const now = /* @__PURE__ */ new Date();
    now.setSeconds(0, 0);
    return `<TimeTrigger>
      <StartBoundary>${now.toISOString().slice(0, 16)}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT${n}M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>`;
  }
  if (/^\d+$/.test(minE) && hourE === "*" && domE === "*" && monthE === "*" && dowE === "*") {
    const now = /* @__PURE__ */ new Date();
    now.setSeconds(0, 0);
    return `<TimeTrigger>
      <StartBoundary>${now.toISOString().slice(0, 16)}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT1H</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>`;
  }
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && domE === "*" && monthE === "*" && dowE === "*") {
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>`;
  }
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && domE === "*" && monthE === "*" && /^[\d,]+$/.test(dowE)) {
    const days = dowE.split(",").map((d) => `<${DOW_ELEMS[+d]} />`).join("");
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <WeeksInterval>1</WeeksInterval>
        <DaysOfWeek>${days}</DaysOfWeek>
      </ScheduleByWeek>
    </CalendarTrigger>`;
  }
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && /^\d+$/.test(domE) && monthE === "*" && dowE === "*") {
    const allMonths = MONTH_ELEMS.slice(1).map((m) => `<${m} />`).join("");
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>${domE}</Day></DaysOfMonth>
        <Months>${allMonths}</Months>
      </ScheduleByMonth>
    </CalendarTrigger>`;
  }
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && /^\d+$/.test(domE) && /^\d+$/.test(monthE) && dowE === "*") {
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>${domE}</Day></DaysOfMonth>
        <Months><${MONTH_ELEMS[+monthE]} /></Months>
      </ScheduleByMonth>
    </CalendarTrigger>`;
  }
  const tomorrow = /* @__PURE__ */ new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return `<CalendarTrigger>
    <StartBoundary>${tomorrow.toISOString().slice(0, 16)}</StartBoundary>
    <Enabled>true</Enabled>
    <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
  </CalendarTrigger>`;
}
function buildTaskXml(task, logPath) {
  const rclone = findRclonePath();
  const args = [...buildRcloneArgs(task), "--use-json-log", "--verbose"];
  const argsStr = args.map((a) => {
    if (a.startsWith("--")) return a;
    return a.includes(" ") ? `"${a.replace(/"/g, '\\"')}"` : a;
  }).join(" ");
  const cmdArgs = `/c "${rclone}" ${argsStr} > "${logPath}" 2>&1`;
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>OpenSync: ${escapeXml(task.name)}</Description>
  </RegistrationInfo>
  <Triggers>
    ${cronToTriggerXml(task.schedule)}
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT4H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>${escapeXml(cmdArgs)}</Arguments>
    </Exec>
  </Actions>
</Task>`;
}
function winRegister(task, logPath) {
  const taskName = winTaskName(task.id);
  const xml = buildTaskXml(task, logPath);
  const tmpPath = path.join(os.tmpdir(), `opensync_${task.id}.xml`);
  try {
    fs.writeFileSync(tmpPath, xml, { encoding: "utf16le" });
    child_process.spawnSync("schtasks", ["/delete", "/tn", taskName, "/f"], { encoding: "utf-8" });
    child_process.spawnSync("schtasks", ["/create", "/tn", taskName, "/xml", tmpPath, "/f"], { encoding: "utf-8" });
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
    }
  }
}
function winUnregister(taskId) {
  child_process.spawnSync("schtasks", ["/delete", "/tn", winTaskName(taskId), "/f"], { encoding: "utf-8" });
}
function winListManagedIds() {
  const r = child_process.spawnSync("schtasks", ["/query", "/fo", "CSV", "/nh"], { encoding: "utf-8" });
  if (r.status !== 0) return [];
  return r.stdout.split("\n").flatMap((l) => {
    const m = l.match(/"OpenSync_([a-f0-9-]+)"/);
    return m ? [m[1]] : [];
  });
}
function register(task, userDataPath) {
  if (!task.schedule) return;
  const logsDir = path.join(userDataPath, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `${task.id}.log`);
  if (process.platform === "win32") {
    winRegister(task, logPath);
  } else {
    unixRegister(task, logPath);
  }
}
function unregister(taskId) {
  if (process.platform === "win32") {
    winUnregister(taskId);
  } else {
    unixUnregister(taskId);
  }
}
function syncAll(tasks, userDataPath) {
  const taskIds = new Set(tasks.map((t) => t.id));
  const managed = process.platform === "win32" ? winListManagedIds() : unixListManagedIds();
  for (const id of managed) {
    if (!taskIds.has(id)) unregister(id);
  }
  for (const task of tasks) {
    if (task.schedule) {
      register(task, userDataPath);
    } else {
      unregister(task.id);
    }
  }
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
function reconcileLastRunTimes() {
  const tasks = loadTasks();
  const logsDir = path.join(electron.app.getPath("userData"), "logs");
  let changed = false;
  for (const task of tasks) {
    const logPath = path.join(logsDir, `${task.id}.log`);
    if (!fs.existsSync(logPath)) continue;
    try {
      const mtime = fs.statSync(logPath).mtime.toISOString();
      if (!task.lastRunAt || mtime > task.lastRunAt) {
        task.lastRunAt = mtime;
        changed = true;
      }
    } catch {
    }
  }
  if (changed) saveTasks(tasks);
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1245,
    height: 800,
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
  electron.ipcMain.handle("tasks:getAll", () => {
    reconcileLastRunTimes();
    return loadTasks();
  });
  electron.ipcMain.handle("tasks:add", (_, taskData) => {
    const tasks = loadTasks();
    const newTask = {
      ...taskData,
      id: crypto.randomUUID(),
      status: "idle"
    };
    tasks.push(newTask);
    saveTasks(tasks);
    register(newTask, electron.app.getPath("userData"));
    return newTask;
  });
  electron.ipcMain.handle("tasks:update", (_, id, data) => {
    const tasks = loadTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...data };
      saveTasks(tasks);
      const updated = tasks[idx];
      if (updated.schedule) {
        register(updated, electron.app.getPath("userData"));
      } else {
        unregister(id);
      }
    }
  });
  electron.ipcMain.handle("tasks:delete", (_, id) => {
    const tasks = loadTasks().filter((t) => t.id !== id);
    saveTasks(tasks);
    unregister(id);
  });
  electron.ipcMain.handle("sync:start", (_, taskId) => {
    if (!mainWindow) return;
    if (isRunning(taskId)) return;
    const task = loadTasks().find((t) => t.id === taskId);
    if (!task) return;
    const logsDir = path.join(electron.app.getPath("userData"), "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, `${taskId}.log`);
    function stampLastRun() {
      const all = loadTasks();
      const idx = all.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        all[idx].lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
        saveTasks(all);
      }
    }
    startSync(taskId, task, mainWindow, { onComplete: stampLastRun, onError: stampLastRun }, logPath);
  });
  electron.ipcMain.handle("logs:read", (_, taskId) => {
    const logPath = path.join(electron.app.getPath("userData"), "logs", `${taskId}.log`);
    if (!fs.existsSync(logPath)) return null;
    try {
      return fs.readFileSync(logPath, "utf-8");
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("sync:stop", (_, taskId) => {
    stopSync(taskId);
  });
  electron.ipcMain.handle("remotes:list", () => {
    return new Promise((resolve) => {
      child_process.execFile("rclone", ["listremotes"], (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }
        const remotes = stdout.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
        resolve(remotes);
      });
    });
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
  reconcileLastRunTimes();
  syncAll(loadTasks(), electron.app.getPath("userData"));
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
