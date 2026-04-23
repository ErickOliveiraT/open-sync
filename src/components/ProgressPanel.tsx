import { useSyncStore } from '../store/useSyncStore'

interface Props {
  taskId: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function ProgressPanel({ taskId }: Props) {
  const stats = useSyncStore((s) => s.progress[taskId])

  if (!stats) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-transparent p-5 text-slate-400 text-sm">
        Waiting for progress data…
      </div>
    )
  }

  const percent =
    stats.totalBytes > 0
      ? Math.min(100, Math.round((stats.bytes / stats.totalBytes) * 100))
      : 0

  const speedMBs = (stats.speed / 1_048_576).toFixed(2)

  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-transparent p-5 space-y-4">
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{formatBytes(stats.bytes)} / {formatBytes(stats.totalBytes)}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Speed" value={`${speedMBs} MB/s`} />
        <Stat label="Files" value={`${stats.transfers} / ${stats.totalTransfers}`} />
        <Stat label="ETA" value={formatEta(stats.eta)} />
        <Stat label="Elapsed" value={formatElapsed(stats.elapsedTime)} />
      </div>

      {stats.errors > 0 && (
        <div className="text-sm text-red-400">
          {stats.errors} error{stats.errors > 1 ? 's' : ''} encountered
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  )
}
