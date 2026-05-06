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
          .map((l) => l.trim().replace(/:$/, ''))
          .filter((l) => l.length > 0)
        resolve(remotes)
      })
    })
  })

  ipcMain.handle('remotes:delete', (_event, name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      execFile('rclone', ['config', 'delete', name], (error) => {
        if (error) { reject(new Error(error.message)); return }
        resolve()
      })
    })
  })

  ipcMain.handle('remotes:obscure', (_event, password: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      execFile('rclone', ['obscure', password], (error, stdout) => {
        if (error) { reject(new Error(error.message)); return }
        resolve(stdout.trim())
      })
    })
  })

  ipcMain.handle('remotes:create', (
    _event,
    name: string,
    type: string,
    params: Record<string, string>
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const kvArgs = Object.entries(params).map(([k, v]) => `${k}=${v}`)
      execFile('rclone', ['config', 'create', name, type, ...kvArgs], (error) => {
        if (error) { reject(new Error(error.message)); return }
        resolve()
      })
    })
  })

  ipcMain.handle('remotes:authorize', (_event, name: string, type: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      execFile('rclone', ['authorize', type], { timeout: 300_000 }, (error, stdout) => {
        if (error) { reject(new Error(error.message)); return }
        const match = stdout.match(/--->\s*(\{[\s\S]*?\})\s*<---/)
        if (!match) {
          reject(new Error('Could not parse authorization token from rclone output'))
          return
        }
        const token = match[1].trim()
        execFile('rclone', ['config', 'create', name, type, `token=${token}`], (err2) => {
          if (err2) { reject(new Error(err2.message)); return }
          resolve()
        })
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

  // --- Backup / Restore ---

  ipcMain.handle('tasks:export', async (): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    if (!mainWindow) return { success: false, error: 'No window' }
    const date = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export tasks',
      defaultPath: `opensync-backup-${date}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    try {
      const backup = { version: 1, exportedAt: new Date().toISOString(), tasks: loadTasks() }
      writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to write file' }
    }
  })

  ipcMain.handle('tasks:import', async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (!mainWindow) return { success: false, error: 'No window' }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Restore tasks from backup',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return { success: false }
    try {
      const raw = JSON.parse(readFileSync(result.filePaths[0], 'utf-8'))
      if (!raw.tasks || !Array.isArray(raw.tasks)) return { success: false, error: 'Invalid backup file' }
      const existing = loadTasks()
      for (const t of existing) scheduler.unregister(t.id)
      const tasks: SyncTask[] = raw.tasks.map((t: SyncTask) => ({ ...t, status: 'idle' as const }))
      saveTasks(tasks)
      for (const t of tasks) {
        if (t.schedule) scheduler.register(t, app.getPath('userData'))
      }
      return { success: true, count: tasks.length }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to parse file' }
    }
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
