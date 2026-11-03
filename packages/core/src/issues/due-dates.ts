import type { StatusCategory } from '@linear/db'

/**
 * Due dates are calendar days (`YYYY-MM-DD`) with no time or timezone. "Today" is
 * always the viewer's local day, sent by the client, so the server never guesses a
 * timezone (docs/domain.md → Due dates). All arithmetic runs on UTC midnights, where
 * every day is exactly 24 hours long.
 */
export type IsoDate = string

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

/** Due within this many days (today included) counts as "due soon". */
export const DUE_SOON_DAYS = 2

function toUtc(date: IsoDate) {
  const match = ISO_DATE.exec(date)
  if (!match) return null
  const [, y, m, d] = match.map(Number) as [number, number, number, number]
  const time = Date.UTC(y, m - 1, d)
  const parsed = new Date(time)
  // Rejects rolled-over days like 2026-02-30.
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d)
    return null
  return time
}

function fromUtc(time: number): IsoDate {
  return new Date(time).toISOString().slice(0, 10)
}

export function isIsoDate(value: string) {
  return toUtc(value) !== null
}

function utc(date: IsoDate) {
  const time = toUtc(date)
  if (time === null) throw new RangeError(`Not a calendar date: ${date}`)
  return time
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(utc(date) + days * DAY_MS)
}

/** Whole days from `today` to `due`: 0 today, 1 tomorrow, negative when past. */
export function daysUntil(due: IsoDate, today: IsoDate) {
  return Math.round((utc(due) - utc(today)) / DAY_MS)
}

/** The Sunday ending the Monday–Sunday week that contains `today`. */
export function endOfWeek(today: IsoDate): IsoDate {
  const weekday = new Date(utc(today)).getUTCDay() // 0 Sunday … 6 Saturday
  return addDays(today, (7 - weekday) % 7)
}

export type DueState = 'overdue' | 'dueSoon' | 'normal'

/**
 * How a due date reads today. Completed and canceled issues are never overdue or
 * due soon: the date no longer asks for anything.
 */
export function classifyDueDate(
  due: IsoDate | null,
  today: IsoDate,
  category: StatusCategory,
): DueState | null {
  if (!due) return null
  if (category === 'completed' || category === 'canceled') return 'normal'
  const days = daysUntil(due, today)
  if (days < 0) return 'overdue'
  if (days <= DUE_SOON_DAYS) return 'dueSoon'
  return 'normal'
}
