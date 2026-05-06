import { useState } from 'react'
import { useSyncStore } from '../store/useSyncStore'
import ConfirmModal from '../components/ConfirmModal'

type Feedback = { type: 'success' | 'error'; message: string } | null

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
      <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V6.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 6.636v6.614Z" />
      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
    </svg>
  )
}

export default function SettingsPage() {
  const setTasks = useSyncStore((s) => s.setTasks)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleExport() {
    setExporting(true)
    setFeedback(null)
    try {
      const result = await window.electronAPI.exportTasks()
      if (result.success && result.filePath) {
        setFeedback({ type: 'success', message: `Exported to: ${result.filePath}` })
      } else if (!result.success && result.error) {
        setFeedback({ type: 'error', message: result.error })
      }
    } catch (e) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Export failed' })
    } finally {
      setExporting(false)
    }
  }

  async function handleImportConfirmed() {
    setShowConfirm(false)
    setImporting(true)
    setFeedback(null)
    try {
      const result = await window.electronAPI.importTasks()
      if (result.success) {
        const tasks = await window.electronAPI.getTasks()
        setTasks(tasks)
        setFeedback({
          type: 'success',
          message: `Restored ${result.count} task${result.count === 1 ? '' : 's'} successfully.`,
        })
      } else if (result.error) {
        setFeedback({ type: 'error', message: result.error })
      }
    } catch (e) {
      setFeedback({ type: 'error', message: e instanceof Error ? e.message : 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Application preferences and data management
        </p>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-800 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Backup &amp; Restore</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Export your tasks to a file for safekeeping, or restore from a previously exported backup.
            Restoring will replace all current tasks.
          </p>
        </div>

        {feedback && (
          <div
            className={`rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-4 ${
              feedback.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300'
            }`}
          >
            <span className="break-all">{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <DownloadIcon />
            {exporting ? 'Exporting…' : 'Export tasks'}
          </button>

          <button
            onClick={() => { setFeedback(null); setShowConfirm(true) }}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UploadIcon />
            {importing ? 'Restoring…' : 'Restore from backup'}
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Restore from backup"
          message="All current tasks will be replaced by the tasks from the backup file. This action cannot be undone. Continue?"
          confirmLabel="Restore"
          onConfirm={handleImportConfirmed}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
