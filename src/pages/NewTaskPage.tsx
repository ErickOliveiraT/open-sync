import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import TaskForm, { type TaskFormValues } from '../components/TaskForm'

export default function NewTaskPage() {
  const navigate = useNavigate()
  const { addTask } = useSyncStore()

  async function handleSubmit(values: TaskFormValues) {
    const newTask = await window.electronAPI.addTask(values)
    addTask(newTask)
    navigate('/tasks')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/tasks')}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">New Sync Task</h1>
      </div>

      <TaskForm
        submitLabel="Save Task"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/tasks')}
      />
    </div>
  )
}
