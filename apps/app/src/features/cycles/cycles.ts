import type { Cycle, CycleSettings } from '@linear/contract'

export type CycleState = 'current' | 'upcoming' | 'past'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** "Launch", or "Cycle 4" for an unnamed cycle. */
export function cycleName(cycle: Pick<Cycle, 'name' | 'number'>) {
  return cycle.name ?? `Cycle ${cycle.number}`
}

// Cycles run on UTC calendar days (docs/domain.md → Cycles), so dates are shown in UTC.
const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** "Nov 2 – Nov 15": the first and last day (the window's end is exclusive). */
export function cycleRange(cycle: { startsAt: Date; endsAt: Date }) {
  const lastDay = new Date(cycle.endsAt.getTime() - 1)
  return `${dayFormat.format(cycle.startsAt)} – ${dayFormat.format(lastDay)}`
}

/** "Cycle 4 · Nov 2 – Nov 15", as the picker lists cycles. */
export function cycleOptionLabel(cycle: Cycle) {
  return `${cycleName(cycle)} · ${cycleRange(cycle)}`
}

export function cycleState(cycle: Cycle, now = new Date()): CycleState {
  if (cycle.completedAt || cycle.endsAt.getTime() <= now.getTime()) return 'past'
  if (cycle.startsAt.getTime() <= now.getTime()) return 'current'
  return 'upcoming'
}

/** Cycles an issue can be put in: the current one and upcoming ones, soonest first. */
export function assignableCycles(cycles: Cycle[], now = new Date()) {
  return cycles
    .filter((cycle) => cycleState(cycle, now) !== 'past')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

/** Share of the scope that is completed, 0–100. */
export function cyclePercent(progress: Cycle['progress']) {
  return progress.scope === 0 ? 0 : Math.round((progress.completed / progress.scope) * 100)
}

/**
 * The first cycle a team would get if it turned cycles on now, for the settings
 * preview. Mirrors `nextCycleWindows` in packages/core for a team without cycles:
 * it starts on the latest start weekday at or before today (UTC).
 */
export function previewFirstCycle(
  settings: Pick<CycleSettings, 'cycleDurationWeeks' | 'cycleStartWeekday'>,
  now = new Date(),
) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const back = (new Date(today).getUTCDay() - settings.cycleStartWeekday + 7) % 7
  const startsAt = new Date(today - back * DAY_MS)
  return { startsAt, endsAt: new Date(startsAt.getTime() + settings.cycleDurationWeeks * WEEK_MS) }
}

export type BurnUpPoint = { day: number; scope: number; completed: number }

/**
 * Chart points from the daily snapshots: days without a snapshot are skipped, and
 * days after today aren't drawn yet.
 */
export function burnUpPoints(scope: (number | null)[], completed: (number | null)[]) {
  const points: BurnUpPoint[] = []
  for (let day = 0; day < scope.length; day++) {
    const s = scope[day]
    if (s === null || s === undefined) continue
    points.push({ day, scope: s, completed: completed[day] ?? 0 })
  }
  return points
}

/** Number of days in the cycle. */
export function cycleDays(cycle: { startsAt: Date; endsAt: Date }) {
  return Math.round((cycle.endsAt.getTime() - cycle.startsAt.getTime()) / DAY_MS)
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
