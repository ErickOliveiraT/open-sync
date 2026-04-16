import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import type { SyncTask } from '../types'

interface Props {
  task: SyncTask
  onDeleted: () => void
}

const STATUS_STYLES: Record<string, string> = {
  idle: 'bg-slate-600 text-slate-200',
  running: 'bg-blue-600 text-white animate-pulse',
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
}

const TYPE_STYLES: Record<string, string> = {
  sync: 'bg-violet-700 text-white',
  copy: 'bg-amber-600 text-white',
}

export default function TaskCard({ task, onDeleted }: Props) {
  const navigate = useNavigate()
  const { updateTaskStatus, clearLogs } = useSyncStore()

  async function handleRun() {
    updateTaskStatus(task.id, 'running')
    clearLogs(task.id)
    await window.electronAPI.startSync(task.id)
    navigate(`/tasks/${task.id}/run`)
  }

  async function handleDelete() {
    await window.electronAPI.deleteTask(task.id)
    onDeleted()
  }

  const isRunning = task.status === 'running'

  return (
    <div className="flex items-center gap-4 rounded-xl bg-slate-800 px-5 py-4 shadow">
      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-white truncate">{task.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[task.type]}`}>
            {task.type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[task.status]}`}>
            {task.status}
          </span>
        </div>
        <div className="text-xs text-slate-400 truncate">
          <span className="text-slate-300">{task.source}</span>
          <span className="mx-2">→</span>
          <span className="text-slate-300">{task.destination}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? 'Running…' : 'Run'}
        </button>
        <button
          onClick={handleDelete}
          disabled={isRunning}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-red-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Delete task"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
