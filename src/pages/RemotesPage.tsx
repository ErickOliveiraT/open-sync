import { useEffect, useState } from 'react'

// Guesses a storage type icon from the remote name prefix
function remoteIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('drive') || lower.includes('gdrive')) return '📁'
  if (lower.includes('s3') || lower.includes('aws'))        return '🪣'
  if (lower.includes('dropbox'))                            return '📦'
  if (lower.includes('onedrive') || lower.includes('od'))   return '🔷'
  if (lower.includes('b2'))                                 return '🗄️'
  if (lower.includes('sftp') || lower.includes('ssh'))      return '🖥️'
  if (lower.includes('ftp'))                                return '📡'
  return '☁️'
}

export default function RemotesPage() {
  const [remotes, setRemotes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Remotes</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Cloud storage remotes configured in rclone
        </p>
      </div>

      {loading && (
        <div className="text-slate-400 text-sm">Loading remotes…</div>
      )}

      {error && (
        <div className="rounded-xl bg-red-900/40 border border-red-700 px-5 py-4 text-red-300 text-sm">
          Failed to list remotes: {error}
        </div>
      )}

      {!loading && !error && remotes.length === 0 && (
        <div className="rounded-xl bg-slate-800 p-8 text-center text-slate-500">
          <div className="text-4xl mb-3">☁️</div>
          <p className="text-lg font-medium text-slate-400 mb-1">No remotes configured</p>
          <p className="text-sm">
            Add a remote with{' '}
            <code className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-xs">
              rclone config
            </code>{' '}
            in a terminal, then reload this page.
          </p>
        </div>
      )}

      {!loading && remotes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {remotes.map((remote) => (
            <div
              key={remote}
              className="flex items-center gap-4 rounded-xl bg-slate-800 px-5 py-4"
            >
              <span className="text-2xl">{remoteIcon(remote)}</span>
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{remote}</p>
                <p className="text-xs text-slate-500 mt-0.5">rclone remote</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate-600">
        To add or edit remotes, run{' '}
        <code className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">rclone config</code>{' '}
        in a terminal.
      </div>
    </div>
  )
}
