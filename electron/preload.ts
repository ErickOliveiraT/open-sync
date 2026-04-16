import { contextBridge, ipcRenderer } from 'electron'
import type { SyncTask, ProgressPayload, CompletePayload, ErrorPayload } from '../src/types'

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

  // Push event subscriptions (main → renderer)
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
})
