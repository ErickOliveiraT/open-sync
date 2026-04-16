import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'
import type { TaskType } from '../types'

export default function NewTaskPage() {
  const navigate = useNavigate()
  const { addTask } = useSyncStore()

  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [type, setType] = useState<TaskType>('sync')
  const [submitting, setSubmitting] = useState(false)

  async function pickFolder(setter: (v: string) => void) {
    const path = await window.electronAPI.openFolder()
    if (path) setter(path)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !source.trim() || !destination.trim()) return

    setSubmitting(true)
    const newTask = await window.electronAPI.addTask({
      name: name.trim(),
      source: source.trim(),
      destination: destination.trim(),
      type,
    })
    addTask(newTask)
    navigate('/')
  }

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-white">New Sync Task</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <Field label="Task name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Photos backup"
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
              placeholder="/home/user/Documents"
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
              placeholder="gdrive:backup  or  /tmp/backup"
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
          <p className="text-xs text-slate-500 mt-1">
            Use a local path or a configured rclone remote (e.g. <code>gdrive:backup</code>).
          </p>
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
                  {t === 'sync' ? '(mirror — deletes removed files)' : '(copy — keeps destination files)'}
                </span>
              </label>
            ))}
          </div>
        </Field>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Saving…' : 'Save Task'}
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
