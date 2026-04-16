import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import type { TaskType } from '../types'

export default function EditTaskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tasks, mergeTasks } = useSyncStore()

  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [type, setType] = useState<TaskType>('sync')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load tasks if store is empty (e.g. direct URL navigation), then seed the form
  useEffect(() => {
    async function init() {
      let list = tasks
      if (list.length === 0) {
        list = await window.electronAPI.getTasks()
        mergeTasks(list)
      }
      const task = list.find((t) => t.id === id)
      if (!task) { navigate('/tasks'); return }
      setName(task.name)
      setSource(task.source)
      setDestination(task.destination)
      setType(task.type)
      setReady(true)
    }
    init()
  }, [id])

  async function pickFolder(setter: (v: string) => void) {
    const path = await window.electronAPI.openFolder()
    if (path) setter(path)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !name.trim() || !source.trim() || !destination.trim()) return
    setSubmitting(true)
    await window.electronAPI.updateTask(id, {
      name: name.trim(),
      source: source.trim(),
      destination: destination.trim(),
      type,
    })
    // Refresh store from disk
    const updated = await window.electronAPI.getTasks()
    mergeTasks(updated)
    navigate('/tasks')
  }

  if (!ready) {
    return <div className="p-6 text-slate-400 text-sm">Loading…</div>
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/tasks')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-white">Edit Task</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <Field label="Task name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
        </Field>

        {/* Source */}
        <Field label="Source folder (local)">
          <div className="flex gap-2">
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => pickFolder(setSource)}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
            >
              Browse
            </button>
          </div>
        </Field>

        {/* Destination */}
        <Field label="Destination (local path or rclone remote)">
          <div className="flex gap-2">
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => pickFolder(setDestination)}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
            >
              Browse
            </button>
          </div>
        </Field>

        {/* Type */}
        <Field label="Sync type">
          <div className="flex gap-4">
            {(['sync', 'copy'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-slate-300 capitalize">{t}</span>
                <span className="text-xs text-slate-500">
                  {t === 'sync' ? '(mirror)' : '(copy only)'}
                </span>
              </label>
            ))}
          </div>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
