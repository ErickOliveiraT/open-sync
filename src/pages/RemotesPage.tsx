import { useEffect, useState } from 'react'
import AddRemoteModal from '../components/AddRemoteModal'
import ConfirmModal from '../components/ConfirmModal'

function remoteIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('drive') || lower.includes('gdrive')) return '📁'
  if (lower.includes('s3') || lower.includes('aws'))        return '🪣'
  if (lower.includes('dropbox'))                            return '📦'
  if (lower.includes('onedrive') || lower.includes('od'))   return '🔷'
  if (lower.includes('b2'))                                 return '🗄️'
  if (lower.includes('sftp') || lower.includes('ssh'))      return '🖥️'
  if (lower.includes('ftp'))                                return '📡'
  if (lower.includes('azure'))                              return '🔷'
  if (lower.includes('box'))                                return '🗂️'
  if (lower.includes('pcloud'))                             return '☁️'
  if (lower.includes('yandex'))                             return '🌐'
  if (lower.includes('webdav'))                             return '🌍'
  if (lower.includes('r2') || lower.includes('cloudflare')) return '🟠'
  return '☁️'
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193v-.443A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

export default function RemotesPage() {
  const [remotes, setRemotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingRemote, setDeletingRemote] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function fetchRemotes() {
    setLoading(true)
    setError(null)
    window.electronAPI
      .listRemotes()
      .then((list) => {
        setRemotes(list)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => { fetchRemotes() }, [])

  async function handleDeleteConfirmed() {
    if (!deletingRemote) return
    try {
      await window.electronAPI.deleteRemote(deletingRemote)
      setDeletingRemote(null)
      fetchRemotes()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete remote')
      setDeletingRemote(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Remotes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Cloud storage remotes configured in rclone
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add Remote
          </button>
          <button
            onClick={fetchRemotes}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-slate-500 dark:text-slate-400 text-sm">Loading remotes…</div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 px-5 py-4 text-red-600 dark:text-red-300 text-sm">
          Failed to list remotes: {error}
        </div>
      )}

      {deleteError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 px-5 py-4 text-red-600 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="text-red-400 hover:text-red-200 transition-colors ml-4 shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {!loading && !error && remotes.length === 0 && (
        <div className="rounded-xl bg-white dark:bg-slate-800 p-8 text-center text-slate-500">
          <div className="text-4xl mb-3">☁️</div>
          <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-1">No remotes configured</p>
          <p className="text-sm">
            Click <strong className="text-slate-700 dark:text-slate-300">Add Remote</strong> to get started.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-slate-500 text-xs">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
        </svg>
        <p>
          Remotes can also be configured directly via{' '}
          <code className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1 py-0.5 rounded">rclone config</code>
          {' '}and will appear here after a refresh.
        </p>
      </div>

      {!loading && remotes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {remotes.map((remote) => (
            <div
              key={remote}
              className="relative flex items-center gap-4 rounded-xl bg-white dark:bg-slate-800 px-5 py-4 group"
            >
              <span className="text-2xl">{remoteIcon(remote)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-900 dark:text-white font-medium truncate">{remote}</p>
                <p className="text-xs text-slate-500 mt-0.5">rclone remote</p>
              </div>
              <button
                onClick={() => { setDeletingRemote(remote); setDeleteError(null) }}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-700 hover:text-slate-900 dark:text-white transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                title={`Delete ${remote}`}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddRemoteModal
          onSuccess={() => { setShowAddModal(false); fetchRemotes() }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {deletingRemote && (
        <ConfirmModal
          title="Delete remote"
          message={`Remove "${deletingRemote}" from rclone config? This does not delete any data in the remote storage.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => { setDeletingRemote(null); setDeleteError(null) }}
        />
      )}
    </div>
  )
}
