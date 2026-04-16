import { useEffect } from 'react'
import { useSyncStore } from '../store/useSyncStore'
import type { ProgressPayload, StartedPayload, CompletePayload, ErrorPayload } from '../types'

/**
 * Registers IPC event listeners once for the lifetime of the app.
 * Must be called at the top of App.tsx so listeners are always active.
 */
export function useSyncEvents(): void {
  const { updateTaskStatus, setProgress, appendLog, setCommand } = useSyncStore()

  useEffect(() => {
    window.electronAPI.onStarted((payload: StartedPayload) => {
      setCommand(payload.taskId, payload.command)
    })

    window.electronAPI.onProgress((payload: ProgressPayload) => {
      // Update progress panel if we have stats
      if (payload.stats) {
        setProgress(payload.taskId, payload.stats)
      }
      // Append to log viewer (skip pure stats-only debug noise)
      if (payload.log.msg && payload.log.level !== 'debug') {
        appendLog(payload.taskId, {
          taskId: payload.taskId,
          timestamp: payload.log.time,
          level: payload.log.level,
          msg: payload.log.msg,
        })
      }
    })

    window.electronAPI.onComplete((payload: CompletePayload) => {
      updateTaskStatus(payload.taskId, 'success')
      appendLog(payload.taskId, {
        taskId: payload.taskId,
        timestamp: new Date().toISOString(),
        level: 'info',
        msg: 'Sync completed successfully.',
      })
    })

    window.electronAPI.onError((payload: ErrorPayload) => {
      updateTaskStatus(payload.taskId, 'error')
      appendLog(payload.taskId, {
        taskId: payload.taskId,
        timestamp: new Date().toISOString(),
        level: 'error',
        msg: payload.message,
      })
    })

    // Cleanup listeners on unmount to prevent duplicates (e.g. React StrictMode)
    return () => {
      window.electronAPI.removeAllListeners('sync:started')
      window.electronAPI.removeAllListeners('sync:progress')
      window.electronAPI.removeAllListeners('sync:complete')
      window.electronAPI.removeAllListeners('sync:error')
    }
  }, [updateTaskStatus, setProgress, appendLog])
}
