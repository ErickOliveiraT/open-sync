import { contextBridge, ipcRenderer } from 'electron'
import type { SyncTask, ProgressPayload, StartedPayload, CompletePayload, ErrorPayload } from '../src/types'

// Expose a typed API to the renderer process via the contextBridge.
// The renderer must NEVER import from 'electron' directly.
contextBridge.exposeInMainWorld('electronAPI', {
  // Task CRUD
  getTasks: (): Promise<SyncTask[]> =>
    ipcRenderer.invoke('tasks:getAll'),

  addTask: (task: Omit<SyncTask, 'id' | 'status'>): Promise<SyncTask> =>
    ipcRenderer.invoke('tasks:add', task),

  updateTask: (id: string, data: Partial<SyncTask>): Promise<void> =>
    ipcRenderer.invoke('tasks:update', id, data),

  deleteTask: (id: string): Promise<void> =>
    ipcRenderer.invoke('tasks:delete', id),

  // Sync control
  startSync: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('sync:start', taskId),

  stopSync: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('sync:stop', taskId),

  // Native dialog
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  // Remotes
  listRemotes: (): Promise<string[]> =>
    ipcRenderer.invoke('remotes:list'),

  createRemote: (name: string, type: string, params: Record<string, string>): Promise<void> =>
    ipcRenderer.invoke('remotes:create', name, type, params),

  deleteRemote: (name: string): Promise<void> =>
    ipcRenderer.invoke('remotes:delete', name),

  authorizeRemote: (name: string, type: string): Promise<void> =>
    ipcRenderer.invoke('remotes:authorize', name, type),

  obscurePassword: (password: string): Promise<string> =>
    ipcRenderer.invoke('remotes:obscure', password),

  // Logs
  readTaskLog: (taskId: string): Promise<string | null> =>
    ipcRenderer.invoke('logs:read', taskId),

  // Push event subscriptions (main → renderer)
  onStarted: (cb: (payload: StartedPayload) => void): void => {
    ipcRenderer.on('sync:started', (_event, data: StartedPayload) => cb(data))
  },

  onProgress: (cb: (payload: ProgressPayload) => void): void => {
    ipcRenderer.on('sync:progress', (_event, data: ProgressPayload) => cb(data))
  },

  onComplete: (cb: (payload: CompletePayload) => void): void => {
    ipcRenderer.on('sync:complete', (_event, data: CompletePayload) => cb(data))
  },

  onError: (cb: (payload: ErrorPayload) => void): void => {
    ipcRenderer.on('sync:error', (_event, data: ErrorPayload) => cb(data))
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel)
  },

  checkRclone: (): Promise<boolean> => ipcRenderer.invoke('rclone:check'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),

  exportTasks: (): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('tasks:export'),

  importTasks: (): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('tasks:import'),
})
