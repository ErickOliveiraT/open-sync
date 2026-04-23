import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSyncStore } from '../store/useSyncStore'

interface ParsedLine {
  level: string
  msg: string
  time: string
}

const LEVEL_STYLES: Record<string, string> = {
  debug:   'text-slate-500',
  info:    'text-slate-300',
  warning: 'text-amber-400',
  error:   'text-red-400 border-l-2 border-red-500 pl-2',
}

function parseLine(raw: string): ParsedLine {
  try {
    const obj = JSON.parse(raw)
    return { level: obj.level ?? 'info', msg: obj.msg ?? raw, time: obj.time ?? '' }
  } catch {
    return { level: 'info', msg: raw, time: '' }
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleTimeString() } catch { return iso }
}

export default function LogsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tasks = useSyncStore((s) => s.tasks)
  const task = tasks.find((t) => t.id === id)

  const [lines, setLines] = useState<ParsedLine[] | null>(null) // null = loading
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    window.electronAPI.readTaskLog(id).then((raw) => {
      if (raw === null) { setLines([]); return }
      const parsed = raw
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(parseLine)
      setLines(parsed)
    })
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [lines])

  // Manual runs write a header line with the rclone command; scheduled runs do not.
  const isCommandHeader = (l: ParsedLine) => l.level === 'info' && l.msg.startsWith('rclone ')
  const hasHeader = lines !== null && lines.length > 0 && isCommandHeader(lines[0])
  const commandLine = hasHeader ? lines![0] : null
  const logLines = lines ? (hasHeader ? lines.slice(1) : lines) : []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {task ? task.name : 'Execution Log'}
          </h1>
          {task && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {task.source} → {task.destination}
            </p>
          )}
        </div>
      </div>

      {/* Command */}
      {commandLine && (
        <div className="flex items-start gap-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 overflow-x-auto">
          <span className="text-slate-600 select-none shrink-0">$</span>
          <span className="text-slate-600 dark:text-slate-300 break-all">{commandLine.msg}</span>
        </div>
      )}

      {/* Log content */}
      <div className="rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-[28rem] overflow-y-auto p-3 font-mono text-xs">
        {lines === null ? (
          <span className="text-slate-500">Loading…</span>
        ) : logLines.length === 0 ? (
          <span className="text-slate-500">
            No log found for this task. Run the task first to generate a log.
          </span>
        ) : (
          logLines.map((entry, i) => (
            <div key={i} className={`mb-0.5 ${LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.info}`}>
              {entry.time && (
                <span className="text-slate-600 mr-2">{formatTime(entry.time)}</span>
              )}
              <span className="uppercase mr-2 opacity-70">[{entry.level}]</span>
              <span>{entry.msg}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
