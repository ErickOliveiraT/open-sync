function matchField(expr: string, val: number): boolean {
  for (const part of expr.split(',')) {
    if (part === '*') return true
    const stepRange = part.match(/^(\d+)-(\d+)\/(\d+)$/)
    if (stepRange) {
      for (let i = parseInt(stepRange[1]); i <= parseInt(stepRange[2]); i += parseInt(stepRange[3]))
        if (i === val) return true
      continue
    }
    const starStep = part.match(/^\*\/(\d+)$/)
    if (starStep) { if (val % parseInt(starStep[1]) === 0) return true; continue }
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) { if (val >= parseInt(range[1]) && val <= parseInt(range[2])) return true; continue }
    const valStep = part.match(/^(\d+)\/(\d+)$/)
    if (valStep) { if (val >= parseInt(valStep[1]) && (val - parseInt(valStep[1])) % parseInt(valStep[2]) === 0) return true; continue }
    if (/^\d+$/.test(part) && parseInt(part) === val) return true
  }
  return false
}

export function nextCronRun(cron: string): Date | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minE, hourE, domE, monthE, dowE] = parts

  const start = new Date()
  start.setSeconds(0, 0)
  start.setMinutes(start.getMinutes() + 1)

  for (let i = 0; i < 366 * 24 * 60; i++) {
    const d = new Date(start.getTime() + i * 60_000)
    if (
      matchField(minE,   d.getMinutes()) &&
      matchField(hourE,  d.getHours()) &&
      matchField(domE,   d.getDate()) &&
      matchField(monthE, d.getMonth() + 1) &&
      matchField(dowE,   d.getDay())
    ) return d
  }
  return null
}

export function formatNextRun(date: Date): string {
  const now  = new Date()
  const diff = date.getTime() - now.getTime()
  const hhmm = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0)
  const dateMidnight  = new Date(date); dateMidnight.setHours(0, 0, 0, 0)
  const dayDiff = Math.round((dateMidnight.getTime() - todayMidnight.getTime()) / 86_400_000)

  if (diff < 60_000) return 'In less than a minute'
  if (dayDiff === 0) return `Today at ${hhmm}`
  if (dayDiff === 1) return `Tomorrow at ${hhmm}`
  return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} at ${hhmm}`
}
