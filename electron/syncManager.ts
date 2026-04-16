import { spawn, ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'
import type { SyncTask, RcloneLogLine, ProgressPayload } from '../src/types'

// Map of taskId → active ChildProcess
const activeProcesses = new Map<string, ChildProcess>()

interface SyncCallbacks {
  onComplete?: () => void
  onError?: () => void
}

/** Strips surrounding quotes that users sometimes paste into path fields. */
function stripSurroundingQuotes(s: string): string {
  return s.replace(/^(['"])(.*)\1$/, '$2').trim()
}

/** Wraps an arg in double-quotes for display. Always quotes paths; skips flags. */
function shellQuote(s: string): string {
  if (s.startsWith('-')) return s          // flags don't need quoting
  return `"${s}"`                          // always quote paths and remotes
}

/**
 * Starts a rclone sync/copy process for the given task.
 * Streams stdout/stderr, parses each line as JSON, and fires IPC events.
 */
export function startSync(taskId: string, task: SyncTask, win: BrowserWindow, callbacks?: SyncCallbacks): void {
  if (isRunning(taskId)) return

  // Strip any accidental surrounding quotes before passing to spawn
  const source      = stripSurroundingQuotes(task.source)
  const destination = stripSurroundingQuotes(task.destination)

  const args = [
    task.type,    // 'sync' or 'copy'
    source,
    destination,
    '--stats=1s',
    '--use-json-log',
    '--verbose',
  ]

  const proc = spawn('rclone', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  activeProcesses.set(taskId, proc)

  // Build a display-friendly command with shell-quoted args
  const command = `rclone ${args.map(shellQuote).join(' ')}`
  win.webContents.send('sync:started', { taskId, command })

  // Buffer to accumulate incomplete lines across chunk boundaries
  let stdoutBuffer = ''
  let stderrBuffer = ''

  function handleChunk(buffer: { value: string }, chunk: Buffer): void {
    buffer.value += chunk.toString()
    const lines = buffer.value.split('\n')
    buffer.value = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const obj: RcloneLogLine = JSON.parse(trimmed)
        const payload: ProgressPayload = {
          taskId,
          stats: obj.stats ?? null,
          log: obj,
        }
        win.webContents.send('sync:progress', payload)
      } catch {
        // Non-JSON line — forward as a warning so it appears in the log viewer
        const payload: ProgressPayload = {
          taskId,
          stats: null,
          log: {
            level: 'warning',
            msg: trimmed,
            time: new Date().toISOString(),
          },
        }
        win.webContents.send('sync:progress', payload)
      }
    }
  }

  const stdoutBuf = { value: stdoutBuffer }
  const stderrBuf = { value: stderrBuffer }

  proc.stdout?.on('data', (chunk: Buffer) => handleChunk(stdoutBuf, chunk))
  proc.stderr?.on('data', (chunk: Buffer) => handleChunk(stderrBuf, chunk))

  proc.on('close', (code) => {
    activeProcesses.delete(taskId)
    if (code === 0) {
      win.webContents.send('sync:complete', { taskId })
      callbacks?.onComplete?.()
    } else {
      win.webContents.send('sync:error', {
        taskId,
        message: `rclone exited with code ${code}`,
      })
      callbacks?.onError?.()
    }
  })

  proc.on('error', (err) => {
    activeProcesses.delete(taskId)
    win.webContents.send('sync:error', { taskId, message: err.message })
    callbacks?.onError?.()
  })
}

/**
 * Sends SIGTERM to the running process for the given taskId.
 */
export function stopSync(taskId: string): void {
  const proc = activeProcesses.get(taskId)
  if (proc) {
    proc.kill('SIGTERM')
    activeProcesses.delete(taskId)
  }
}

/**
 * Kills all active rclone processes. Called on app quit.
 */
export function killAll(): void {
  for (const [, proc] of activeProcesses) {
    proc.kill('SIGTERM')
  }
  activeProcesses.clear()
}

/**
 * Returns true if a sync process is already running for this taskId.
 */
export function isRunning(taskId: string): boolean {
  return activeProcesses.has(taskId)
}
