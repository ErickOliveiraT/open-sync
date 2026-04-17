import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { SyncTask } from '../src/types'

// ── Rclone args ───────────────────────────────────────────────────────────────

function buildRcloneArgs(task: SyncTask): string[] {
  const clean = (s: string) => s.replace(/^(['"])(.*)\1$/, '$2').trim()
  const filters = (task.filters ?? [])
    .filter(f => f.value.trim())
    .map(f => `--${f.type}=${f.value.trim()}`)
  return [task.type, clean(task.source), clean(task.destination), ...filters]
}

// ── Rclone path detection ─────────────────────────────────────────────────────

function findRclonePath(): string {
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  const r = spawnSync(cmd, ['rclone'], { encoding: 'utf-8' })
  if (r.status === 0 && r.stdout.trim()) {
    return r.stdout.trim().split('\n')[0].trim()
  }
  return 'rclone'
}

// ── Linux / macOS — crontab ───────────────────────────────────────────────────

const MARKER = '# opensync:'

function getCrontab(): string {
  const r = spawnSync('crontab', ['-l'], { encoding: 'utf-8' })
  return r.status === 0 ? r.stdout : ''
}

function setCrontab(content: string): void {
  spawnSync('crontab', ['-'], { input: content, encoding: 'utf-8' })
}

function unixUnregister(taskId: string): void {
  const lines = getCrontab().split('\n').filter(l => !l.includes(`${MARKER}${taskId}`))
  const content = lines.join('\n').trimEnd()
  setCrontab(content ? content + '\n' : '')
}

function unixRegister(task: SyncTask, logPath: string): void {
  unixUnregister(task.id)
  const rclone = findRclonePath()
  const args = [...buildRcloneArgs(task), '--use-json-log', '--verbose']
  const quoted = args.map(a => a.startsWith('--') ? a : `"${a.replace(/"/g, '\\"')}"`).join(' ')
  const logsDir = logPath.substring(0, logPath.lastIndexOf('/'))
  const line = `${task.schedule} mkdir -p "${logsDir}" && "${rclone}" ${quoted} > "${logPath}" 2>&1 ${MARKER}${task.id}`
  const current = getCrontab().trimEnd()
  setCrontab((current ? current + '\n' : '') + line + '\n')
}

function unixListManagedIds(): string[] {
  return getCrontab()
    .split('\n')
    .flatMap(l => {
      const m = l.match(new RegExp(`${MARKER}([\\w-]+)`))
      return m ? [m[1]] : []
    })
}

// ── Windows — Task Scheduler XML ──────────────────────────────────────────────

function winTaskName(taskId: string): string {
  return `OpenSync_${taskId}`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MONTH_ELEMS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const DOW_ELEMS: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}

function nextStartBoundary(h: string, m: string): string {
  const d = new Date()
  d.setHours(parseInt(h), parseInt(m), 0, 0)
  if (d <= new Date()) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 16)
}

function cronToTriggerXml(cron: string): string {
  const [minE, hourE, domE, monthE, dowE] = cron.trim().split(/\s+/)

  // Every N minutes
  if (/^\*\/(\d+)$/.test(minE) && hourE === '*' && domE === '*' && monthE === '*' && dowE === '*') {
    const n = minE.slice(2)
    const now = new Date(); now.setSeconds(0, 0)
    return `<TimeTrigger>
      <StartBoundary>${now.toISOString().slice(0, 16)}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT${n}M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>`
  }

  // Hourly at :M
  if (/^\d+$/.test(minE) && hourE === '*' && domE === '*' && monthE === '*' && dowE === '*') {
    const now = new Date(); now.setSeconds(0, 0)
    return `<TimeTrigger>
      <StartBoundary>${now.toISOString().slice(0, 16)}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>PT1H</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>`
  }

  // Daily
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && domE === '*' && monthE === '*' && dowE === '*') {
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>`
  }

  // Weekly
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && domE === '*' && monthE === '*' && /^[\d,]+$/.test(dowE)) {
    const days = dowE.split(',').map(d => `<${DOW_ELEMS[+d]} />`).join('')
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek>
        <WeeksInterval>1</WeeksInterval>
        <DaysOfWeek>${days}</DaysOfWeek>
      </ScheduleByWeek>
    </CalendarTrigger>`
  }

  // Monthly
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && /^\d+$/.test(domE) && monthE === '*' && dowE === '*') {
    const allMonths = MONTH_ELEMS.slice(1).map(m => `<${m} />`).join('')
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>${domE}</Day></DaysOfMonth>
        <Months>${allMonths}</Months>
      </ScheduleByMonth>
    </CalendarTrigger>`
  }

  // Yearly
  if (/^\d+$/.test(minE) && /^\d+$/.test(hourE) && /^\d+$/.test(domE) && /^\d+$/.test(monthE) && dowE === '*') {
    return `<CalendarTrigger>
      <StartBoundary>${nextStartBoundary(hourE, minE)}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByMonth>
        <DaysOfMonth><Day>${domE}</Day></DaysOfMonth>
        <Months><${MONTH_ELEMS[+monthE]} /></Months>
      </ScheduleByMonth>
    </CalendarTrigger>`
  }

  // Fallback: daily at midnight tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return `<CalendarTrigger>
    <StartBoundary>${tomorrow.toISOString().slice(0, 16)}</StartBoundary>
    <Enabled>true</Enabled>
    <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
  </CalendarTrigger>`
}

function buildTaskXml(task: SyncTask, logPath: string): string {
  const rclone = findRclonePath()
  const args = [...buildRcloneArgs(task), '--use-json-log', '--verbose']
  const argsStr = args.map(a => {
    if (a.startsWith('--')) return a
    return a.includes(' ') ? `"${a.replace(/"/g, '\\"')}"` : a
  }).join(' ')

  // Wrap in cmd.exe so shell redirection (>) is available for log output
  const cmdArgs = `/c "${rclone}" ${argsStr} > "${logPath}" 2>&1`

  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>OpenSync: ${escapeXml(task.name)}</Description>
  </RegistrationInfo>
  <Triggers>
    ${cronToTriggerXml(task.schedule!)}
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT4H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>${escapeXml(cmdArgs)}</Arguments>
    </Exec>
  </Actions>
</Task>`
}

function winRegister(task: SyncTask, logPath: string): void {
  const taskName = winTaskName(task.id)
  const xml = buildTaskXml(task, logPath)
  const tmpPath = join(tmpdir(), `opensync_${task.id}.xml`)
  try {
    writeFileSync(tmpPath, xml, { encoding: 'utf16le' })
    spawnSync('schtasks', ['/delete', '/tn', taskName, '/f'], { encoding: 'utf-8' })
    spawnSync('schtasks', ['/create', '/tn', taskName, '/xml', tmpPath, '/f'], { encoding: 'utf-8' })
  } finally {
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}

function winUnregister(taskId: string): void {
  spawnSync('schtasks', ['/delete', '/tn', winTaskName(taskId), '/f'], { encoding: 'utf-8' })
}

function winListManagedIds(): string[] {
  const r = spawnSync('schtasks', ['/query', '/fo', 'CSV', '/nh'], { encoding: 'utf-8' })
  if (r.status !== 0) return []
  return r.stdout
    .split('\n')
    .flatMap(l => {
      const m = l.match(/"OpenSync_([a-f0-9-]+)"/)
      return m ? [m[1]] : []
    })
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function register(task: SyncTask, userDataPath: string): void {
  if (!task.schedule) return
  const logsDir = join(userDataPath, 'logs')
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true })
  const logPath = join(logsDir, `${task.id}.log`)
  if (process.platform === 'win32') {
    winRegister(task, logPath)
  } else {
    unixRegister(task, logPath)
  }
}

export function unregister(taskId: string): void {
  if (process.platform === 'win32') {
    winUnregister(taskId)
  } else {
    unixUnregister(taskId)
  }
}

/**
 * Called on app startup. Syncs all task schedules with the OS:
 * - Registers tasks that have a schedule
 * - Removes OS entries for tasks that no longer exist or no longer have a schedule
 */
export function syncAll(tasks: SyncTask[], userDataPath: string): void {
  const taskIds = new Set(tasks.map(t => t.id))

  // Clean up orphaned OS entries (task was deleted but OS entry remains)
  const managed = process.platform === 'win32' ? winListManagedIds() : unixListManagedIds()
  for (const id of managed) {
    if (!taskIds.has(id)) unregister(id)
  }

  // Register tasks with schedules; clean up those without
  for (const task of tasks) {
    if (task.schedule) {
      register(task, userDataPath)
    } else {
      unregister(task.id)
    }
  }
}
