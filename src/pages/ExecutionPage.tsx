import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import ProgressPanel from '../components/ProgressPanel'
import LogViewer from '../components/LogViewer'

export default function ExecutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tasks    = useSyncStore((s) => s.tasks)
  const logs     = useSyncStore((s) => s.logs)
  const commands = useSyncStore((s) => s.commands)
  const { updateTaskStatus, clearLogs } = useSyncStore()
  // Tracks whether *this mount* already triggered a startSync call
  const launchedRef = useRef(false)

  const task = tasks.find((t) => t.id === id)

  useEffect(() => {
    if (!id || launchedRef.current) return
    launchedRef.current = true

    // If the task already has logs it means we navigated back to a running task —
    // just show the live state, don't restart or wipe anything.
    const alreadyRunning = (logs[id]?.length ?? 0) > 0
    if (alreadyRunning) return

    clearLogs(id)
    window.electronAPI.startSync(id)
  }, [id, logs, clearLogs])

  async function handleStop() {
    if (!id) return
    await window.electronAPI.stopSync(id)
    updateTaskStatus(id, 'idle')
  }

  if (!task) {
    return (
      <div className="p-6 text-slate-500 dark:text-slate-400">
        Task not found.{' '}
        <button className="text-blue-400 underline" onClick={() => navigate('/tasks')}>
          Go back
        </button>
      </div>
    )
  }

  const isRunning = task.status === 'running'

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/tasks')}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{task.name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {task.source} → {task.destination}
          </p>
        </div>
        {/* Status badge */}
        <StatusBadge status={task.status} />
      </div>

      {/* Progress */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Progress</h2>
        <ProgressPanel taskId={task.id} />
      </div>

      {/* Logs */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Logs</h2>

        {/* rclone command that was executed */}
        {commands[task.id] && (
          <div className="flex items-start gap-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-4 py-2.5 mb-2 font-mono text-xs text-slate-500 dark:text-slate-400 overflow-x-auto">
            <span className="text-slate-600 select-none shrink-0">$</span>
            <span className="text-slate-600 dark:text-slate-300 break-all">{commands[task.id]}</span>
          </div>
        )}

        <LogViewer taskId={task.id} />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {isRunning && (
          <button
            onClick={handleStop}
            className="px-5 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-600 transition-colors"
          >
            Stop
          </button>
        )}
        <button
          onClick={() => navigate('/tasks')}
          className="px-5 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          {isRunning ? 'Back (sync continues)' : 'Back to Tasks'}
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: 'bg-slate-600 text-slate-200',
    running: 'bg-blue-600 text-white',
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
  }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status] ?? styles.idle}`}>
      {status}
    </span>
  )
}
