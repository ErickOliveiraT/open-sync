import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import ProgressPanel from '../components/ProgressPanel'
import LogViewer from '../components/LogViewer'

export default function ExecutionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tasks = useSyncStore((s) => s.tasks)
  const { updateTaskStatus, clearLogs } = useSyncStore()
  const [started, setStarted] = useState(false)

  const task = tasks.find((t) => t.id === id)

  useEffect(() => {
    if (!id || started) return

    // Start sync if the task exists and is in running state
    // (status was set to 'running' by TaskCard before navigation)
    clearLogs(id)
    window.electronAPI.startSync(id)
    setStarted(true)
  }, [id, started, clearLogs])

  async function handleStop() {
    if (!id) return
    await window.electronAPI.stopSync(id)
    updateTaskStatus(id, 'idle')
  }

  if (!task) {
    return (
      <div className="p-6 text-slate-400">
        Task not found.{' '}
        <button className="text-blue-400 underline" onClick={() => navigate('/')}>
          Go back
        </button>
      </div>
    )
  }

  const isRunning = task.status === 'running'

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{task.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {task.source} → {task.destination}
          </p>
        </div>
        {/* Status badge */}
        <StatusBadge status={task.status} />
      </div>

      {/* Progress */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Progress</h2>
        <ProgressPanel taskId={task.id} />
      </div>

      {/* Logs */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">Logs</h2>
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
          onClick={() => navigate('/')}
          className="px-5 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
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
