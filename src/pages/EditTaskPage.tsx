import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import TaskForm, { type TaskFormValues } from '../components/TaskForm'
import type { SyncTask } from '../types'

export default function EditTaskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks, mergeTasks } = useSyncStore()
  const [task, setTask] = useState<SyncTask | null>(null)

  useEffect(() => {
    async function init() {
      let list = tasks
      if (list.length === 0) {
        list = await window.electronAPI.getTasks()
        mergeTasks(list)
      }
      const found = list.find((t) => t.id === id)
      if (!found) { navigate('/tasks'); return }
      setTask(found)
    }
    init()
  }, [id])

  async function handleSubmit(values: TaskFormValues) {
    if (!id) return
    await window.electronAPI.updateTask(id, values)
    const updated = await window.electronAPI.getTasks()
    mergeTasks(updated)
    navigate('/tasks')
  }

  if (!task) {
    return <div className="p-6 text-slate-400 text-sm">Loading…</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/tasks')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-white">Edit Task</h1>
      </div>

      <TaskForm
        initialValues={{ name: task.name, source: task.source, destination: task.destination, type: task.type, filters: task.filters ?? [], webhooks: task.webhooks ?? [], schedule: task.schedule }}
        submitLabel="Save Changes"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/tasks')}
      />
    </div>
  )
}
