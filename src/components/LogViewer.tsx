import { useEffect, useRef } from 'react'
import { useSyncStore } from '../store/useSyncStore'

interface Props {
  taskId: string
}

const LEVEL_STYLES: Record<string, string> = {
  debug: 'text-slate-500',
  info: 'text-slate-300',
  warning: 'text-amber-400',
  error: 'text-red-400 border-l-2 border-red-500 pl-2',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return iso
  }
}

export default function LogViewer({ taskId }: Props) {
  const logs = useSyncStore((s) => s.logs[taskId] ?? [])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the bottom whenever new log entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-700 h-64 overflow-y-auto p-3 font-mono text-xs">
      {logs.length === 0 ? (
        <span className="text-slate-600">No logs yet…</span>
      ) : (
        logs.map((entry, i) => (
          <div key={i} className={`mb-0.5 ${LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.info}`}>
            <span className="text-slate-600 mr-2">{formatTime(entry.timestamp)}</span>
            <span className="uppercase mr-2 opacity-70">[{entry.level}]</span>
            <span>{entry.msg}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
