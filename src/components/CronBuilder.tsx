import { useEffect, useState } from 'react'

type FreqMode = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

const FREQ_TABS: { id: FreqMode; label: string }[] = [
  { id: 'minutes', label: 'Minutes' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
]

const DOW = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 0 },
]

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const EVERY_N_OPTS = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30]

// ── Validation ────────────────────────────────────────────────────────────────

function isValidCronField(f: string): boolean {
  return f.split(',').every(p =>
    p === '*' ||
    /^\d+$/.test(p) ||
    /^\d+-\d+$/.test(p) ||
    /^\*\/\d+$/.test(p) ||
    /^\d+\/\d+$/.test(p) ||
    /^\d+-\d+\/\d+$/.test(p),
  )
}

export function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/)
  return parts.length === 5 && parts.every(isValidCronField)
}

// ── Parser ────────────────────────────────────────────────────────────────────

type ParsedCron =
  | { mode: 'minutes'; n: number }
  | { mode: 'hourly'; minute: number }
  | { mode: 'daily'; hour: number; minute: number }
  | { mode: 'weekly'; hour: number; minute: number; days: number[] }
  | { mode: 'monthly'; hour: number; minute: number; dom: number }
  | { mode: 'yearly'; hour: number; minute: number; dom: number; month: number }
  | { mode: 'custom' }

function parseCron(cron: string): ParsedCron {
  if (!cron || !isValidCron(cron)) return { mode: 'custom' }
  const [min, hour, dom, month, dow] = cron.trim().split(/\s+/)
  if (/^\*\/\d+$/.test(min) && hour === '*' && dom === '*' && month === '*' && dow === '*')
    return { mode: 'minutes', n: parseInt(min.slice(2)) }
  if (/^\d+$/.test(min) && hour === '*' && dom === '*' && month === '*' && dow === '*')
    return { mode: 'hourly', minute: parseInt(min) }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && month === '*' && dow === '*')
    return { mode: 'daily', hour: parseInt(hour), minute: parseInt(min) }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && month === '*' && /^[\d,]+$/.test(dow))
    return { mode: 'weekly', hour: parseInt(hour), minute: parseInt(min), days: dow.split(',').map(Number) }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && month === '*' && dow === '*')
    return { mode: 'monthly', hour: parseInt(hour), minute: parseInt(min), dom: parseInt(dom) }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && /^\d+$/.test(month) && dow === '*')
    return { mode: 'yearly', hour: parseInt(hour), minute: parseInt(min), dom: parseInt(dom), month: parseInt(month) }
  return { mode: 'custom' }
}

// ── Description ───────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function cronDescription(cron: string): string {
  const p = parseCron(cron)
  switch (p.mode) {
    case 'minutes': return p.n === 1 ? 'Every minute' : `Every ${p.n} minutes`
    case 'hourly': return `Every hour at :${String(p.minute).padStart(2, '0')}`
    case 'daily': return `Every day at ${hhmm(p.hour, p.minute)}`
    case 'weekly': {
      const names = p.days.map(d => DOW.find(x => x.value === d)?.label ?? d).join(', ')
      return `Every ${names} at ${hhmm(p.hour, p.minute)}`
    }
    case 'monthly': return `On the ${ordinal(p.dom)} of every month at ${hhmm(p.hour, p.minute)}`
    case 'yearly': return `Every year on ${MONTH_NAMES[p.month]} ${ordinal(p.dom)} at ${hhmm(p.hour, p.minute)}`
    default: return ''
  }
}

// ── TimeSelect ────────────────────────────────────────────────────────────────

function TimeSelect({ hour, minute, onHour, onMinute }: {
  hour: number; minute: number
  onHour: (h: number) => void; onMinute: (m: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-400">Starts at:</span>
      <select value={hour} onChange={e => onHour(+e.target.value)} className="input w-20 text-center">
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-slate-500 font-medium">:</span>
      <select value={minute} onChange={e => onMinute(+e.target.value)} className="input w-20 text-center">
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  )
}

// ── CronBuilder ───────────────────────────────────────────────────────────────

interface Props {
  value: string
  onChange: (cron: string) => void
}

export default function CronBuilder({ value, onChange }: Props) {
  const p = parseCron(value)

  const [mode, setMode] = useState<FreqMode>(p.mode)
  const [everyN, setEveryN] = useState(p.mode === 'minutes' ? p.n : 5)
  const [hourlyMin, setHourlyMin] = useState(p.mode === 'hourly' ? p.minute : 0)

  const hasTime = p.mode === 'daily' || p.mode === 'weekly' || p.mode === 'monthly' || p.mode === 'yearly'
  const [timeHour, setTimeHour] = useState(hasTime ? (p as { hour: number }).hour : 12)
  const [timeMin, setTimeMin] = useState(hasTime ? (p as { minute: number }).minute : 0)
  const [weekDays, setWeekDays] = useState<Set<number>>(
    () => p.mode === 'weekly' ? new Set(p.days) : new Set([1]),
  )
  const [monthDay, setMonthDay] = useState(
    p.mode === 'monthly' || p.mode === 'yearly' ? (p as { dom: number }).dom : 1,
  )
  const [yearMonth, setYearMonth] = useState(p.mode === 'yearly' ? p.month : 1)
  const [customCron, setCustomCron] = useState(p.mode === 'custom' ? (value ?? '') : '')

  function buildCron(): string {
    const m = String(timeMin)
    const h = String(timeHour)
    switch (mode) {
      case 'minutes': return `*/${everyN} * * * *`
      case 'hourly': return `${hourlyMin} * * * *`
      case 'daily': return `${m} ${h} * * *`
      case 'weekly': {
        const days = [...weekDays].sort((a, b) => a - b).join(',')
        return `${m} ${h} * * ${days || '1'}`
      }
      case 'monthly': return `${m} ${h} ${monthDay} * *`
      case 'yearly': return `${m} ${h} ${monthDay} ${yearMonth} *`
      case 'custom': return customCron
    }
  }

  useEffect(() => {
    onChange(buildCron())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, everyN, hourlyMin, timeHour, timeMin, weekDays, monthDay, yearMonth, customCron])

  function toggleDay(day: number) {
    setWeekDays(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  const generatedCron = buildCron()
  const desc = cronDescription(generatedCron)
  const customValid = mode !== 'custom' || isValidCron(customCron)

  return (
    <div className="space-y-4">
      {/* Frequency tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-600">
        {FREQ_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${mode === tab.id
              ? 'border-blue-500 text-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mode content */}
      <div className="min-h-[72px]">
        {mode === 'minutes' && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">Every</span>
            <select value={everyN} onChange={e => setEveryN(+e.target.value)} className="input w-24">
              {EVERY_N_OPTS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-sm text-slate-500 dark:text-slate-400">minute(s)</span>
          </div>
        )}

        {mode === 'hourly' && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">At minute</span>
            <select value={hourlyMin} onChange={e => setHourlyMin(+e.target.value)} className="input w-20 text-center">
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
              ))}
            </select>
            <span className="text-sm text-slate-500 dark:text-slate-400">of every hour</span>
          </div>
        )}

        {mode === 'daily' && (
          <TimeSelect hour={timeHour} minute={timeMin} onHour={setTimeHour} onMinute={setTimeMin} />
        )}

        {mode === 'weekly' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-x-6 gap-y-2">
              {DOW.map(d => (
                <label key={d.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={weekDays.has(d.value)}
                    onChange={() => toggleDay(d.value)}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">{d.label}</span>
                </label>
              ))}
            </div>
            <TimeSelect hour={timeHour} minute={timeMin} onHour={setTimeHour} onMinute={setTimeMin} />
          </div>
        )}

        {mode === 'monthly' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">On day</span>
              <select value={monthDay} onChange={e => setMonthDay(+e.target.value)} className="input w-20">
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <span className="text-sm text-slate-500 dark:text-slate-400">of every month</span>
            </div>
            <TimeSelect hour={timeHour} minute={timeMin} onHour={setTimeHour} onMinute={setTimeMin} />
          </div>
        )}

        {mode === 'yearly' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-500 dark:text-slate-400">Every year on</span>
              <select value={yearMonth} onChange={e => setYearMonth(+e.target.value)} className="input w-36">
                {MONTH_NAMES.slice(1).map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select value={monthDay} onChange={e => setMonthDay(+e.target.value)} className="input w-20">
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
            <TimeSelect hour={timeHour} minute={timeMin} onHour={setTimeHour} onMinute={setTimeMin} />
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-2">
            <input
              type="text"
              value={customCron}
              onChange={e => setCustomCron(e.target.value)}
              placeholder="* * * * *"
              className={`input w-full font-mono text-sm ${!customValid && customCron ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {!customValid && customCron && (
              <p className="text-xs text-red-400">
                Invalid expression. Expected 5 fields: minute hour day-of-month month day-of-week.
              </p>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-600">
              Format: <code className="text-slate-500">minute hour day-of-month month day-of-week</code>
              {' '}— ex: <code className="text-slate-500">30 9 * * 1-5</code>
            </p>
          </div>
        )}
      </div>

      {/* Generated cron display */}
      {(mode !== 'custom' || (customCron && customValid)) && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3 space-y-1">
          <code className="text-blue-500 dark:text-blue-400 font-mono text-sm">{generatedCron}</code>
          {desc && <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>}
        </div>
      )}
    </div>
  )
}
