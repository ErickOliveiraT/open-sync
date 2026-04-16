import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import * as syncManager from './syncManager'
import type { SyncTask } from '../src/types'

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

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
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
  // --- Task CRUD ---

  ipcMain.handle('tasks:getAll', () => loadTasks())

  ipcMain.handle('tasks:add', (_, taskData: Omit<SyncTask, 'id' | 'status'>) => {
    const tasks = loadTasks()
    const newTask: SyncTask = {
      ...taskData,
      id: randomUUID(),
      status: 'idle',
    }
    tasks.push(newTask)
    saveTasks(tasks)
    return newTask
  })

  ipcMain.handle('tasks:update', (_, id: string, data: Partial<SyncTask>) => {
    const tasks = loadTasks()
    const idx = tasks.findIndex((t) => t.id === id)
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...data }
      saveTasks(tasks)
    }
  })

  ipcMain.handle('tasks:delete', (_, id: string) => {
    const tasks = loadTasks().filter((t) => t.id !== id)
    saveTasks(tasks)
  })

  // --- Sync control ---

  ipcMain.handle('sync:start', (_, taskId: string) => {
    if (!mainWindow) return
    if (syncManager.isRunning(taskId)) return

    const task = loadTasks().find((t) => t.id === taskId)
    if (!task) return

    syncManager.startSync(taskId, task, mainWindow)
  })

  ipcMain.handle('sync:stop', (_, taskId: string) => {
    syncManager.stopSync(taskId)
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
  registerIpcHandlers()
  createWindow()

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
