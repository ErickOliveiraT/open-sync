import { useEffect, useState } from 'react'
import type { TaskType, TaskFilter, FilterType } from '../types'

export interface TaskFormValues {
  name: string
  source: string
  destination: string
  type: TaskType
  filters: TaskFilter[]
}

interface Props {
  initialValues?: TaskFormValues
  submitLabel: string
  onSubmit: (values: TaskFormValues) => Promise<void>
  onCancel: () => void
}

type DestType = 'local' | 'remote'

/** Detects whether a stored destination string is local or remote. */
function detectDestType(dest: string): DestType {
  if (!dest) return 'local'
  // Windows absolute paths like C:\...
  if (/^[A-Za-z]:[/\\]/.test(dest)) return 'local'
  // Unix absolute paths or home-relative
  if (dest.startsWith('/') || dest.startsWith('~')) return 'local'
  // rclone remote format: remotename:path
  if (dest.includes(':')) return 'remote'
  return 'local'
}

/** Splits "gdrive:backup/photos" → { remote: "gdrive:", path: "backup/photos" } */
function parseRemoteDest(dest: string): { remote: string; path: string } {
  const idx = dest.indexOf(':')
  if (idx === -1) return { remote: '', path: '' }
  return { remote: dest.slice(0, idx + 1), path: dest.slice(idx + 1) }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function TaskForm({ initialValues, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName]     = useState(initialValues?.name        ?? '')
  const [source, setSource] = useState(initialValues?.source      ?? '')
  const [type, setType]     = useState<TaskType>(initialValues?.type ?? 'sync')

  // Destination
  const [destType, setDestType] = useState<DestType>(() =>
    detectDestType(initialValues?.destination ?? '')
  )
  const [destLocal, setDestLocal]         = useState(() =>
    detectDestType(initialValues?.destination ?? '') === 'local'
      ? (initialValues?.destination ?? '')
      : ''
  )
  const [destRemote, setDestRemote]       = useState(() => {
    if (detectDestType(initialValues?.destination ?? '') === 'remote') {
      return parseRemoteDest(initialValues!.destination).remote
    }
    return ''
  })
  const [destRemotePath, setDestRemotePath] = useState(() => {
    if (detectDestType(initialValues?.destination ?? '') === 'remote') {
      return parseRemoteDest(initialValues!.destination).path
    }
    return ''
  })

  // Remotes list
  const [remotes, setRemotes]           = useState<string[]>([])
  const [loadingRemotes, setLoadingRemotes] = useState(false)

  // Filters
  const [filters, setFilters] = useState<TaskFilter[]>(
    initialValues?.filters ?? []
  )

  const [submitting, setSubmitting] = useState(false)

  function addFilter() {
    setFilters((prev) => [...prev, { type: 'exclude', value: '' }])
  }

  function removeFilter(idx: number) {
    setFilters((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateFilter(idx: number, patch: Partial<TaskFilter>) {
    setFilters((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    )
  }

  useEffect(() => {
    if (destType !== 'remote') return
    setLoadingRemotes(true)
    window.electronAPI.listRemotes().then((list) => {
      setRemotes(list)
      // Auto-select first remote if none selected yet
      if (!destRemote && list.length > 0) setDestRemote(list[0])
      setLoadingRemotes(false)
    })
  }, [destType])

  async function pickFolder(setter: (v: string) => void) {
    const path = await window.electronAPI.openFolder()
    if (path) setter(path)
  }

  function buildDestination(): string {
    if (destType === 'local') return destLocal.trim()
    // remote: "gdrive:" + "backup/photos" → "gdrive:backup/photos"
    return destRemote + destRemotePath.trim()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const destination = buildDestination()
    if (!name.trim() || !source.trim() || !destination) return
    setSubmitting(true)
    try {
      const cleanFilters = filters.filter((f) => f.value.trim() !== '')
      await onSubmit({ name: name.trim(), source: source.trim(), destination, type, filters: cleanFilters })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Source — always local */}
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
      <Field label="Destination">
        {/* Type toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-slate-700 w-fit mb-3">
          {(['local', 'remote'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDestType(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                destType === t
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t === 'local' ? '📁 Local folder' : '☁️ Remote'}
            </button>
          ))}
        </div>

        {/* Local input */}
        {destType === 'local' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={destLocal}
              onChange={(e) => setDestLocal(e.target.value)}
              placeholder="/home/user/backup"
              required
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => pickFolder(setDestLocal)}
              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
            >
              Browse
            </button>
          </div>
        )}

        {/* Remote input */}
        {destType === 'remote' && (
          <div className="space-y-2">
            {loadingRemotes ? (
              <p className="text-sm text-slate-400">Loading remotes…</p>
            ) : remotes.length === 0 ? (
              <div className="rounded-lg bg-slate-700 border border-slate-600 px-4 py-3 text-sm text-slate-400">
                No remotes configured. Run{' '}
                <code className="bg-slate-800 text-slate-300 px-1 rounded">rclone config</code>{' '}
                in a terminal to add one.
              </div>
            ) : (
              <div className="flex gap-2">
                {/* Remote selector */}
                <select
                  value={destRemote}
                  onChange={(e) => setDestRemote(e.target.value)}
                  className="input w-48 shrink-0"
                  required
                >
                  {remotes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {/* Path within remote */}
                <input
                  type="text"
                  value={destRemotePath}
                  onChange={(e) => setDestRemotePath(e.target.value)}
                  placeholder="path/within/remote  (optional)"
                  className="input flex-1"
                />
              </div>
            )}
            {destRemote && (
              <p className="text-xs text-slate-500">
                Full path:{' '}
                <code className="text-slate-400">{destRemote}{destRemotePath.trim()}</code>
              </p>
            )}
          </div>
        )}
      </Field>

      {/* Sync type */}
      <Field label="Sync type">
        <div className="flex gap-6">
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

      {/* Filters */}
      <Field label="Filters">
        <div className="space-y-2">
          {filters.map((filter, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              {/* Include / Exclude toggle */}
              <select
                value={filter.type}
                onChange={(e) => updateFilter(idx, { type: e.target.value as FilterType })}
                className="input w-32 shrink-0"
              >
                <option value="exclude">Exclude</option>
                <option value="include">Include</option>
              </select>
              {/* Pattern */}
              <input
                type="text"
                value={filter.value}
                onChange={(e) => updateFilter(idx, { value: e.target.value })}
                placeholder="*.tmp  or  /folder/**"
                className="input flex-1 font-mono text-xs"
              />
              {/* Remove */}
              <button
                type="button"
                onClick={() => removeFilter(idx)}
                className="p-2 rounded-lg bg-slate-700 text-slate-400 hover:bg-red-700 hover:text-white transition-colors shrink-0"
                title="Remove filter"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193v-.443A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addFilter}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 text-sm hover:border-slate-400 hover:text-slate-300 transition-colors w-full justify-center"
          >
            <span className="text-lg leading-none">+</span> Add filter
          </button>

          {filters.length > 0 && (
            <p className="text-xs text-slate-600">
              Filters are passed to rclone as{' '}
              <code className="text-slate-500">--include=...</code> /{' '}
              <code className="text-slate-500">--exclude=...</code> in the order listed.
            </p>
          )}
        </div>
      </Field>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting || (destType === 'remote' && remotes.length === 0)}
          className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
