import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { SyncTask, Webhook } from '../src/types'

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

// ── Webhook curl helpers ──────────────────────────────────────────────────────

function unixCurlCmd(webhook: Webhook): string {
  const url = webhook.url.replace(/'/g, "'\\''")
  if (webhook.method === 'POST') {
    const payload = (webhook.payload.trim() || '{}').replace(/'/g, "'\\''")
    return `curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' -d '${payload}' '${url}'`
  }
  return `curl -fsS -o /dev/null '${url}'`
}

function psWebhookCmd(webhook: Webhook): string {
  const url = webhook.url.replace(/'/g, "''")
  if (webhook.method === 'POST') {
    let payload: string
    try { payload = JSON.stringify(JSON.parse(webhook.payload.trim() || '{}')) }
    catch { payload = (webhook.payload.trim() || '{}').replace(/\s*\n\s*/g, ' ') }
    payload = payload.replace(/'/g, "''")
    return `  try { Invoke-RestMethod -Method POST -Uri '${url}' -ContentType 'application/json' -Body '${payload}' -ErrorAction Stop } catch {}`
  }
  return `  try { Invoke-RestMethod -Uri '${url}' -ErrorAction Stop } catch {}`
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

function writeUnixRunnerScript(task: SyncTask, rclone: string, quoted: string, logPath: string): string {
  const scriptPath = logPath.replace(/\.log$/, '.sh')
  const logsDir = logPath.substring(0, logPath.lastIndexOf('/'))

  const successCmds = (task.webhooks ?? [])
    .filter(wh => wh.trigger === 'success')
    .map(wh => `  ${unixCurlCmd(wh)}`)
    .join('\n') || '  :'

  const errorCmds = (task.webhooks ?? [])
    .filter(wh => wh.trigger === 'error')
    .map(wh => `  ${unixCurlCmd(wh)}`)
    .join('\n') || '  :'

  const script = [
    '#!/bin/bash',
    `mkdir -p "${logsDir}"`,
    `"${rclone}" ${quoted} > "${logPath}" 2>&1`,
    '_RC=$?',
    'if [ $_RC -eq 0 ]; then',
    successCmds,
    'else',
    errorCmds,
    'fi',
    'exit $_RC',
    '',
  ].join('\n')

  writeFileSync(scriptPath, script, { encoding: 'utf-8' })
  return scriptPath
}

function unixUnregister(taskId: string): void {
  const lines = getCrontab().split('\n')
  const marker = `${MARKER}${taskId}`
  const existing = lines.find(l => l.includes(marker))
  if (existing) {
    const m = existing.match(/bash "([^"]+)"/)
    if (m) try { unlinkSync(m[1]) } catch { /* ignore */ }
  }
  const filtered = lines.filter(l => !l.includes(marker))
  const content = filtered.join('\n').trimEnd()
  setCrontab(content ? content + '\n' : '')
}

function unixRegister(task: SyncTask, logPath: string): void {
  unixUnregister(task.id)
  const rclone = findRclonePath()
  const args = [...buildRcloneArgs(task), '--use-json-log', '--verbose']
  const quoted = args.map(a => {
    const filterMatch = a.match(/^(--(?:include|exclude))=(.+)$/)
    if (filterMatch) return `${filterMatch[1]}="${filterMatch[2]}"`
    if (a.startsWith('--')) return a
    return `"${a.replace(/"/g, '\\"')}"`
  }).join(' ')
  const scriptPath = writeUnixRunnerScript(task, rclone, quoted, logPath)
  const line = `${task.schedule} bash "${scriptPath}" ${MARKER}${task.id}`
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

// ── Windows — Task Scheduler (PowerShell) ─────────────────────────────────────

function winTaskName(taskId: string): string {
  return `OpenSync_${taskId}`
}

function cronToPsTask(cron: string, taskName: string, runnerPath: string): string {
  const [minE, hourE, domE, monthE, dowE] = cron.trim().split(/\s+/)
  const pad = (s: string) => s.padStart(2, '0')
  const safeRunner = runnerPath.replace(/'/g, "''")
  const safeName = taskName.replace(/'/g, "''")

  const triggerExprs: string[] = []

  if (/^\*\/(\d+)$/.test(minE) && hourE === '*' && domE === '*' && monthE === '*' && dowE === '*') {
    triggerExprs.push(`New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes ${minE.slice(2)})`)
  } else if (/^\d+$/.test(minE) && hourE === '*' && domE === '*' && monthE === '*' && dowE === '*') {
    triggerExprs.push(`New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)`)
  } else if (domE === '*' && monthE === '*' && dowE === '*') {
    for (const h of hourE.split(',')) {
      for (const m of minE.split(',')) {
        if (/^\d+$/.test(h) && /^\d+$/.test(m))
          triggerExprs.push(`New-ScheduledTaskTrigger -Daily -At '${pad(h)}:${pad(m)}'`)
      }
    }
  } else if (domE === '*' && monthE === '*' && /^[\d,]+$/.test(dowE)) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const days = dowE.split(',').map(d => names[+d]).join(',')
    for (const h of hourE.split(',')) {
      for (const m of minE.split(',')) {
        if (/^\d+$/.test(h) && /^\d+$/.test(m))
          triggerExprs.push(`New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${days} -At '${pad(h)}:${pad(m)}'`)
      }
    }
  }

  if (triggerExprs.length === 0)
    triggerExprs.push(`New-ScheduledTaskTrigger -Daily -At '00:00'`)

  const triggerVars = triggerExprs.map((e, i) => `$t${i} = ${e}`).join('\n')
  const triggerArg = triggerExprs.length === 1 ? '$t0' : `@(${triggerExprs.map((_, i) => `$t${i}`).join(', ')})`

  return [
    triggerVars,
    `$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NonInteractive -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${safeRunner}"'`,
    `$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden`,
    `Unregister-ScheduledTask -TaskName '${safeName}' -Confirm:$false -ErrorAction SilentlyContinue`,
    `Register-ScheduledTask -TaskName '${safeName}' -Trigger ${triggerArg} -Action $a -Settings $s -Force`,
  ].join('\n')
}

function writeWinRunnerScript(task: SyncTask, rclone: string, args: string[], logPath: string): string {
  const ps1Path = logPath.replace(/\.log$/, '.ps1')
  const sepIdx = Math.max(logPath.lastIndexOf('/'), logPath.lastIndexOf('\\'))
  const logsDir = logPath.substring(0, sepIdx)
  const psq = (s: string) => `'${s.replace(/'/g, "''")}'`

  const successCmds = (task.webhooks ?? [])
    .filter(wh => wh.trigger === 'success')
    .map(wh => psWebhookCmd(wh))
    .join('\n') || '  # no success webhooks'

  const errorCmds = (task.webhooks ?? [])
    .filter(wh => wh.trigger === 'error')
    .map(wh => psWebhookCmd(wh))
    .join('\n') || '  # no error webhooks'

  const script = [
    `if (-not (Test-Path ${psq(logsDir)})) { New-Item -ItemType Directory -Path ${psq(logsDir)} -Force | Out-Null }`,
    `[IO.File]::WriteAllText(${psq(logPath)}, '')`,
    `& ${psq(rclone)} ${[...args, '--log-file', logPath].map(psq).join(' ')}`,
    `$rc = $LASTEXITCODE`,
    `if ($rc -eq 0) {`,
    successCmds,
    `} else {`,
    errorCmds,
    `}`,
    `exit $rc`,
  ].join('\n')

  writeFileSync(ps1Path, script, { encoding: 'utf-8' })
  return ps1Path
}

function winRegister(task: SyncTask, logPath: string): void {
  const taskName = winTaskName(task.id)
  const rclone = findRclonePath()
  const args = [...buildRcloneArgs(task), '--use-json-log', '--verbose']
  const runnerPath = writeWinRunnerScript(task, rclone, args, logPath)
  const regPsPath = join(tmpdir(), `opensync_${task.id}.ps1`)
  try {
    writeFileSync(regPsPath, cronToPsTask(task.schedule!, taskName, runnerPath), { encoding: 'utf-8' })
    const result = spawnSync('powershell.exe', [
      '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', regPsPath,
    ], { encoding: 'utf-8' })
    if (result.status !== 0) {
      console.error('[scheduler] task registration failed:', result.stderr || result.stdout)
    }
  } finally {
    try { unlinkSync(regPsPath) } catch { /* ignore */ }
  }
}

function winUnregister(taskId: string, userDataPath?: string): void {
  spawnSync('schtasks', ['/delete', '/tn', winTaskName(taskId), '/f'], { encoding: 'utf-8' })
  if (userDataPath) {
    const ps1Path = join(userDataPath, 'logs', `${taskId}.ps1`)
    try { unlinkSync(ps1Path) } catch { /* ignore */ }
  }
}

function winListManagedIds(): string[] {
  const r = spawnSync('schtasks', ['/query', '/fo', 'CSV', '/nh'], { encoding: 'utf-8' })
  if (r.status !== 0) return []
  return r.stdout
    .split('\n')
    .flatMap(l => {
      const m = l.match(/"\\?OpenSync_([a-f0-9-]+)"/)
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

export function unregister(taskId: string, userDataPath?: string): void {
  if (process.platform === 'win32') {
    winUnregister(taskId, userDataPath)
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
    if (!taskIds.has(id)) unregister(id, userDataPath)
  }

  // Register tasks with schedules; clean up those without
  for (const task of tasks) {
    if (task.schedule) {
      register(task, userDataPath)
    } else {
      unregister(task.id, userDataPath)
    }
  }
}
