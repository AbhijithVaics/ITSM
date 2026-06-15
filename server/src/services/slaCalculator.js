// Default business hours: Mon-Fri 09:00-18:00
// Overridable per SLA
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5]
const DEFAULT_START_HOUR = 9
const DEFAULT_END_HOUR = 18

function isWithinBusinessHours(date, workingDays, startHour, endHour) {
  const day = date.getUTCDay()
  const hour = date.getUTCHours()
  if (!workingDays.includes(day)) return false
  return hour >= startHour && hour < endHour
}

function nextBusinessMinute(date, workingDays, startHour) {
  const d = new Date(date)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(d.getUTCMinutes() + 1)

  let attempts = 0
  while (!isWithinBusinessHours(d, workingDays, startHour, startHour + 8) && attempts < 7 * 24 * 60) {
    d.setUTCMinutes(d.getUTCMinutes() + 1)
    attempts++
  }
  return d
}

export function addBusinessMinutes(fromDate, minutes, workingDays, startHour, endHour) {
  const wd = workingDays || DEFAULT_WORKING_DAYS
  const sh = startHour ?? DEFAULT_START_HOUR
  const eh = endHour ?? DEFAULT_END_HOUR

  let remaining = minutes
  let current = new Date(fromDate)

  while (remaining > 0) {
    if (!isWithinBusinessHours(current, wd, sh, eh)) {
      current = nextBusinessMinute(current, wd, sh)
      continue
    }

    const endOfDay = new Date(current)
    endOfDay.setUTCHours(eh, 0, 0, 0)

    const availMin = Math.round((endOfDay - current) / 60000)
    if (availMin <= 0) {
      current = nextBusinessMinute(current, wd, sh)
      continue
    }

    const chunk = Math.min(remaining, availMin)
    current = new Date(current.getTime() + chunk * 60000)
    remaining -= chunk
  }

  return current
}

export function computeSlaDeadline(createdAt, priority, sltTargets) {
  if (!sltTargets || sltTargets.length === 0) return null

  const target = sltTargets.find(t => t.priority === priority) || sltTargets[0]
  if (!target) return null

  const metric = target.metric // 'TTO' or 'TTR'
  const minutes = target.value // stored as minutes

  return {
    metric,
    deadline: addBusinessMinutes(
      new Date(createdAt),
      minutes,
      target.workingDays,
      target.startHour,
      target.endHour
    ),
    targetMinutes: minutes,
  }
}

export function isOverdue(deadline) {
  if (!deadline) return false
  return new Date() > new Date(deadline)
}
