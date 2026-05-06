// Task configuration types
export type TaskType = 'sync' | 'copy'
export type TaskStatus = 'idle' | 'running' | 'success' | 'error'
export type FilterType = 'include' | 'exclude'
export type WebhookMethod = 'GET' | 'POST'
export type WebhookTrigger = 'success' | 'error'

export interface TaskFilter {
  type: FilterType
  value: string
}

export interface Webhook {
  method: WebhookMethod
  trigger: WebhookTrigger
  url: string
  payload: string  // JSON string (used for POST)
}

export interface SyncTask {
  id: string
  name: string
  source: string       // local path or rclone remote, e.g. "/home/user/docs" or "gdrive:backup"
  destination: string  // local path or rclone remote, e.g. "gdrive:backup" or "/tmp/dest"
  type: TaskType
  status: TaskStatus
  filters?: TaskFilter[]
  webhooks?: Webhook[]
  schedule?: string    // cron expression, undefined means no scheduling
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

export interface StartedPayload {
  taskId: string
  command: string   // full rclone command string shown in the UI
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
