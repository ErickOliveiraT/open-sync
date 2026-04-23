import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import ConfirmModal from './ConfirmModal'
import type { SyncTask } from '../types'
import { nextCronRun, formatNextRun } from '../utils/cron'

interface Props {
  task: SyncTask
  onDeleted: () => void
}

const STATUS_STYLES: Record<string, string> = {
  idle:    'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200',
  running: 'bg-blue-600 text-white animate-pulse',
  success: 'bg-green-600 text-white',
  error:   'bg-red-600 text-white',
}

const TYPE_STYLES: Record<string, string> = {
  sync: 'bg-violet-700 text-white',
  copy: 'bg-amber-600 text-white',
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193v-.443A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
  )
}

export default function TaskCard({ task, onDeleted }: Props) {
  const navigate = useNavigate()
  const { updateTaskStatus, clearLogs } = useSyncStore()
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleRun() {
    if (isRunning) {
      navigate(`/tasks/${task.id}/run`)
      return
    }
    updateTaskStatus(task.id, 'running')
    clearLogs(task.id)
    await window.electronAPI.startSync(task.id)
    navigate(`/tasks/${task.id}/run`)
  }

  async function handleDeleteConfirmed() {
    setShowConfirm(false)
    await window.electronAPI.deleteTask(task.id)
    onDeleted()
  }

  const isRunning = task.status === 'running'

  return (
    <>
      <div className="flex items-center gap-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-transparent px-5 py-4 shadow-sm">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900 dark:text-white truncate">{task.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[task.type]}`}>
              {task.type}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[task.status]}`}>
              {task.status}
            </span>
          </div>
          <div className="text-xs text-slate-400 truncate">
            <span className="text-slate-600 dark:text-slate-300">{task.source}</span>
            <span className="mx-2">→</span>
            <span className="text-slate-600 dark:text-slate-300">{task.destination}</span>
          </div>
          <div className="text-xs mt-1">
            {task.schedule ? (() => {
              const next = nextCronRun(task.schedule)
              return next
                ? <span className="text-slate-400">Next run: <span className="text-slate-600 dark:text-slate-200">{formatNextRun(next)}</span></span>
                : <span className="text-slate-400">Next run: unavailable</span>
            })() : (
              <span className="text-slate-400 dark:text-slate-600">Not scheduled</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRun}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            {isRunning ? 'View ›' : 'Run'}
          </button>
          <button
            onClick={() => navigate(`/tasks/${task.id}/edit`)}
            disabled={isRunning}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Edit task"
          >
            <EditIcon />
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isRunning}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-red-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Delete task"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Delete task"
          message={`Are you sure you want to delete "${task.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
