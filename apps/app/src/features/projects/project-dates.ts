// Project start and target dates are calendar days (`YYYY-MM-DD`); they never pass
// through a time zone, so a date picked in one place reads the same everywhere.

const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar day of `date` as `YYYY-MM-DD`. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromDay(day: string): Date {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Nov 3", or "Nov 3, 2027" outside the current year. */
export function formatDay(day: string, today: Date = new Date()): string {
  const date = fromDay(day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

/** Quick picks, like Linear's date menu. */
export function datePresets(today: Date = new Date()): { label: string; day: string }[] {
  const y = today.getFullYear()
  const m = today.getMonth()
  const endOfWeek = new Date(y, m, today.getDate() + ((7 - today.getDay()) % 7))
  const quarterEndMonth = Math.floor(m / 3) * 3 + 3
  return [
    { label: 'Today', day: toDay(today) },
    { label: 'Tomorrow', day: toDay(new Date(y, m, today.getDate() + 1)) },
    { label: 'End of this week', day: toDay(endOfWeek) },
    { label: 'End of this month', day: toDay(new Date(y, m + 1, 0)) },
    { label: 'End of this quarter', day: toDay(new Date(y, quarterEndMonth, 0)) },
    { label: 'End of next quarter', day: toDay(new Date(y, quarterEndMonth + 3, 0)) },
  ]
}

/**
 * A typed date: `YYYY-MM-DD`, or anything the browser parses ("Dec 1 2026",
 * "12/1/2026"). Null when it isn't a real calendar day.
 */
export function parseDay(text: string): string | null {
  const value = text.trim()
  if (!value) return null
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value)
  if (iso) {
    const [, y, m, d] = iso.map(Number) as [number, number, number, number]
    const date = new Date(y, m - 1, d)
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
      ? toDay(date)
      : null
  }
  // Only text with a digit, so words like "end" don't parse as some default date.
  if (!/\d/.test(value)) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : toDay(parsed)
}
