import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { randomUUID } from 'crypto'
import { execFile, execFileSync } from 'child_process'
import * as http from 'http'
import * as https from 'https'
import * as syncManager from './syncManager'
import * as scheduler from './schedulerManager'
import type { SyncTask, Webhook } from '../src/types'

// Path to the tasks JSON file in the user data directory
function getTasksPath(): string {
  return join(app.getPath('userData'), 'tasks.json')
}

function loadTasks(): SyncTask[] {
  const p = getTasksPath()
  if (!existsSync(p)) return []
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as SyncTask[]
    // Always reset runtime status to idle on load
    return raw.map((t) => ({ ...t, status: 'idle' as const }))
  } catch {
    return []
  }
}

function saveTasks(tasks: SyncTask[]): void {
  writeFileSync(getTasksPath(), JSON.stringify(tasks, null, 2), 'utf-8')
}

function fireWebhook(webhook: Webhook): void {
  const body = webhook.method === 'POST' ? (webhook.payload.trim() || '{}') : undefined
  let url: URL
  try { url = new URL(webhook.url) } catch { return }

  const mod = url.protocol === 'https:' ? https : http
  const options: http.RequestOptions = {
    method: webhook.method,
    hostname: url.hostname,
    port: url.port || undefined,
    path: url.pathname + url.search,
    headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
  }

  const req = mod.request(options, (res) => { res.resume() })
  req.on('error', (err) => console.error(`[webhook] ${webhook.method} ${webhook.url} failed:`, err))
  if (body) req.write(body)
  req.end()
}

function fireWebhooks(task: SyncTask, trigger: 'success' | 'error'): void {
  for (const wh of task.webhooks ?? []) {
    if (wh.trigger === trigger) fireWebhook(wh)
  }
}

/** Updates lastRunAt from log file mtime for tasks whose scheduled run happened outside the app. */
function reconcileLastRunTimes(): void {
  const tasks = loadTasks()
  const logsDir = join(app.getPath('userData'), 'logs')
  let changed = false
  for (const task of tasks) {
    const logPath = join(logsDir, `${task.id}.log`)
    if (!existsSync(logPath)) continue
    try {
      const mtime = statSync(logPath).mtime.toISOString()
      if (!task.lastRunAt || mtime > task.lastRunAt) {
        task.lastRunAt = mtime
        changed = true
      }
    } catch { /* ignore */ }
  }
  if (changed) saveTasks(tasks)
}

function isRcloneInstalled(): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(cmd, ['rclone'])
    return true
  } catch {
    return false
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1245,
    height: 800,
    minWidth: 720,
    minHeight: 500,
    title: 'OpenSync',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // In dev mode, load the Vite dev server URL; in production, load the built file
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('rclone:check', () => isRcloneInstalled())
  ipcMain.handle('app:platform', () => process.platform)
  ipcMain.handle('shell:openExternal', (_, url: string) => shell.openExternal(url))

  // --- Task CRUD ---

  ipcMain.handle('tasks:getAll', () => { reconcileLastRunTimes(); return loadTasks() })

  ipcMain.handle('tasks:add', (_, taskData: Omit<SyncTask, 'id' | 'status'>) => {
    const tasks = loadTasks()
    const newTask: SyncTask = {
      ...taskData,
      id: randomUUID(),
      status: 'idle',
    }
    tasks.push(newTask)
    saveTasks(tasks)
    scheduler.register(newTask, app.getPath('userData'))
    return newTask
  })

  ipcMain.handle('tasks:update', (_, id: string, data: Partial<SyncTask>) => {
    const tasks = loadTasks()
    const idx = tasks.findIndex((t) => t.id === id)
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...data }
      saveTasks(tasks)
      const updated = tasks[idx]
      if (updated.schedule) {
        scheduler.register(updated, app.getPath('userData'))
      } else {
        scheduler.unregister(id)
      }
    }
  })

  ipcMain.handle('tasks:delete', (_, id: string) => {
    const tasks = loadTasks().filter((t) => t.id !== id)
    saveTasks(tasks)
    scheduler.unregister(id)
  })

  // --- Sync control ---

  ipcMain.handle('sync:start', (_, taskId: string) => {
    if (!mainWindow) return
    if (syncManager.isRunning(taskId)) return

    const task = loadTasks().find((t) => t.id === taskId)
    if (!task) return

    const logsDir = join(app.getPath('userData'), 'logs')
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true })
    const logPath = join(logsDir, `${taskId}.log`)

    function stampLastRun(trigger: 'success' | 'error') {
      const all = loadTasks()
      const idx = all.findIndex((t) => t.id === taskId)
      if (idx !== -1) {
        const current = all[idx]
        all[idx].lastRunAt = new Date().toISOString()
        saveTasks(all)
        fireWebhooks(current, trigger)
      }
    }

    syncManager.startSync(taskId, task, mainWindow, {
      onComplete: () => stampLastRun('success'),
      onError: () => stampLastRun('error'),
    }, logPath)
  })

  ipcMain.handle('logs:read', (_, taskId: string): string | null => {
    const logPath = join(app.getPath('userData'), 'logs', `${taskId}.log`)
    if (!existsSync(logPath)) return null
    try { return readFileSync(logPath, 'utf-8') } catch { return null }
  })

  ipcMain.handle('sync:stop', (_, taskId: string) => {
    syncManager.stopSync(taskId)
  })

  // --- Remotes ---

  ipcMain.handle('remotes:list', (): Promise<string[]> => {
    return new Promise((resolve) => {
      execFile('rclone', ['listremotes'], (error, stdout) => {
        if (error) {
          resolve([])
          return
        }
        const remotes = stdout
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
        resolve(remotes)
      })
    })
  })

  // --- Native dialogs ---

  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    })
    return result.filePaths[0] ?? null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()
  reconcileLastRunTimes()
  scheduler.syncAll(loadTasks(), app.getPath('userData'))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Kill all rclone processes before the app exits
app.on('before-quit', () => {
  syncManager.killAll()
})
