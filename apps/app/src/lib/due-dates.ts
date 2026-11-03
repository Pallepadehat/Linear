import type { StatusCategory } from '@linear/contract'

// docs/domain.md → Due dates. A due date is a calendar day (`YYYY-MM-DD`); "today" is
// the viewer's local day. Mirrors packages/core/src/issues/due-dates.ts, which the
// app can't import. Arithmetic runs on UTC midnights, so DST never shifts a day.

const DAY_MS = 86_400_000
/** Due within this many days (today included) counts as "due soon". */
export const DUE_SOON_DAYS = 2

function utc(date: string) {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const iso = (time: number) => new Date(time).toISOString().slice(0, 10)

/** The viewer's local calendar day. */
export function todayIso(now = new Date()) {
  return iso(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

export const addDays = (date: string, days: number) => iso(utc(date) + days * DAY_MS)

/** Whole days from `today` to `due`: 0 today, negative when past. */
export const daysUntil = (due: string, today: string) =>
  Math.round((utc(due) - utc(today)) / DAY_MS)

/** The Sunday ending the Monday–Sunday week that contains `today`. */
export function endOfWeek(today: string) {
  return addDays(today, (7 - new Date(utc(today)).getUTCDay()) % 7)
}

export type DueState = 'overdue' | 'dueSoon' | 'normal'

/** Completed and canceled issues are never overdue or due soon. */
export function classifyDueDate(
  due: string | null,
  today: string,
  category: StatusCategory,
): DueState | null {
  if (!due) return null
  if (category === 'completed' || category === 'canceled') return 'normal'
  const days = daysUntil(due, today)
  if (days < 0) return 'overdue'
  if (days <= DUE_SOON_DAYS) return 'dueSoon'
  return 'normal'
}

const short = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const withYear = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "Nov 7"; the year is added when it isn't the current one. */
export function formatDueDate(due: string, today: string) {
  const format = due.slice(0, 4) === today.slice(0, 4) ? short : withYear
  return format.format(new Date(utc(due)))
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

/** Tooltip text: "Due today", "Due in 3 days", "Overdue by 2 days". */
export function describeDueDate(due: string, today: string, category: StatusCategory) {
  const days = daysUntil(due, today)
  if (classifyDueDate(due, today, category) === 'overdue') {
    return `Overdue by ${plural(-days, 'day')}`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days < 0) return `Was due ${plural(-days, 'day')} ago`
  return `Due in ${plural(days, 'day')}`
}

/** The picker's quick options, relative to `today`. */
export function dueDateShortcuts(today: string) {
  return [
    { key: 'today', label: 'Today', date: today },
    { key: 'tomorrow', label: 'Tomorrow', date: addDays(today, 1) },
    { key: 'endOfWeek', label: 'End of this week', date: endOfWeek(today) },
    { key: 'inOneWeek', label: 'In one week', date: addDays(today, 7) },
  ]
}
