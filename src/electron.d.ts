import type {
  SyncTask,
  ProgressPayload,
  StartedPayload,
  CompletePayload,
  ErrorPayload,
} from './types'

export interface ElectronAPI {
  // Task persistence (request/response)
  getTasks: () => Promise<SyncTask[]>
  addTask: (task: Omit<SyncTask, 'id' | 'status'>) => Promise<SyncTask>
  updateTask: (id: string, data: Partial<SyncTask>) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  // Sync control
  startSync: (taskId: string) => Promise<void>
  stopSync: (taskId: string) => Promise<void>

  // Native dialog
  openFolder: () => Promise<string | null>

  // Remotes
  listRemotes: () => Promise<string[]>
  createRemote: (name: string, type: string, params: Record<string, string>) => Promise<void>
  deleteRemote: (name: string) => Promise<void>
  authorizeRemote: (name: string, type: string) => Promise<void>
  obscurePassword: (password: string) => Promise<string>

  // Push events from main process
  onStarted: (cb: (payload: StartedPayload) => void) => void
  onProgress: (cb: (payload: ProgressPayload) => void) => void
  onComplete: (cb: (payload: CompletePayload) => void) => void
  onError: (cb: (payload: ErrorPayload) => void) => void
  removeAllListeners: (channel: string) => void

  // System checks
  checkRclone: () => Promise<boolean>
  getPlatform: () => Promise<string>
  openExternal: (url: string) => Promise<void>

  // Backup / Restore
  exportTasks: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  importTasks: () => Promise<{ success: boolean; count?: number; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
