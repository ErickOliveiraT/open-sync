// Task configuration types
export type TaskType = 'sync' | 'copy'
export type TaskStatus = 'idle' | 'running' | 'success' | 'error'

export interface SyncTask {
  id: string
  name: string
  source: string       // absolute local path
  destination: string  // rclone remote, e.g. "gdrive:backup" or "/tmp/dest"
  type: TaskType
  status: TaskStatus
  lastRunAt?: string   // ISO timestamp
}

// rclone JSON log types
export interface RcloneStats {
  bytes: number
  totalBytes: number
  speed: number          // bytes/sec
  eta: number | null
  transfers: number
  totalTransfers: number
  errors: number
  fatalError: boolean
  elapsedTime: number
}

export interface RcloneLogLine {
  level: 'debug' | 'info' | 'warning' | 'error'
  msg: string
  source?: string
  time: string
  stats?: RcloneStats
  object?: string
}

// IPC payload types
export interface ProgressPayload {
  taskId: string
  stats: RcloneStats | null
  log: RcloneLogLine
}

export interface CompletePayload {
  taskId: string
}

export interface ErrorPayload {
  taskId: string
  message: string
}

// UI log entry
export interface LogEntry {
  taskId: string
  timestamp: string
  level: RcloneLogLine['level']
  msg: string
}
