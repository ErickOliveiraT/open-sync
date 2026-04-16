import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import type { SyncTask } from '../types'

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function StatusBadge({ status }: { status: SyncTask['status'] }) {
  const styles: Record<string, string> = {
    idle:    'bg-slate-600 text-slate-200',
    running: 'bg-blue-600 text-white',
    success: 'bg-green-600 text-white',
    error:   'bg-red-600 text-white',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { tasks, mergeTasks } = useSyncStore()

  useEffect(() => {
    window.electronAPI.getTasks().then(mergeTasks)
  }, [])

  // Tasks that have been run at least once, sorted newest first
  const recentTasks = [...tasks]
    .filter((t) => t.lastRunAt)
    .sort((a, b) => (b.lastRunAt! > a.lastRunAt! ? 1 : -1))
    .slice(0, 8)

  const totalTasks   = tasks.length
  const successCount = tasks.filter((t) => t.status === 'success').length
  const errorCount   = tasks.filter((t) => t.status === 'error').length
  const runningCount = tasks.filter((t) => t.status === 'running').length
  const neverRunCount = tasks.filter((t) => !t.lastRunAt).length

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Home</h1>
        <p className="text-slate-400 text-sm mt-0.5">Overview of your sync activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total tasks"   value={totalTasks}   color="text-white" />
        <StatCard label="Running"       value={runningCount}  color="text-blue-400" />
        <StatCard label="Last succeeded" value={successCount} color="text-green-400" />
        <StatCard label="Last errored"  value={errorCount}   color="text-red-400" />
      </div>

      {/* Recent executions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Recent executions
        </h2>

        {recentTasks.length === 0 ? (
          <div className="rounded-xl bg-slate-800 p-8 text-center text-slate-500">
            {totalTasks === 0 ? (
              <>
                <p className="text-lg mb-2">No tasks yet</p>
                <button
                  onClick={() => navigate('/tasks/new')}
                  className="text-blue-400 underline text-sm"
                >
                  Create your first task
                </button>
              </>
            ) : (
              <p>
                {neverRunCount === 1 ? '1 task has' : `${neverRunCount} tasks have`} never been run.{' '}
                <button
                  onClick={() => navigate('/tasks')}
                  className="text-blue-400 underline"
                >
                  Go to Tasks
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}/run`)}
                className="flex items-center gap-4 rounded-xl bg-slate-800 px-5 py-3 cursor-pointer hover:bg-slate-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">{task.name}</span>
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {task.source} → {task.destination}
                  </p>
                </div>
                <div className="text-xs text-slate-500 shrink-0">
                  {formatDate(task.lastRunAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-slate-800 px-5 py-4">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  )
}
