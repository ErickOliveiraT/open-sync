import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import TaskCard from '../components/TaskCard'

export default function TaskListPage() {
  const navigate = useNavigate()
  const { tasks, setTasks } = useSyncStore()

  async function fetchTasks() {
    const loaded = await window.electronAPI.getTasks()
    setTasks(loaded)
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">OpenSync</h1>
          <p className="text-slate-400 text-sm mt-0.5">File synchronization powered by rclone</p>
        </div>
        <button
          onClick={() => navigate('/tasks/new')}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <div className="text-5xl mb-4">📂</div>
          <p className="text-lg font-medium">No sync tasks yet</p>
          <p className="text-sm mt-1">Click "New Task" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDeleted={fetchTasks} />
          ))}
        </div>
      )}
    </div>
  )
}
