/**
 * Pure cycle date math (docs/domain.md → Cycles). Cycles run on UTC calendar days:
 * a cycle starts at 00:00 UTC on the team's start weekday and lasts a whole number
 * of weeks, so daylight-saving changes never stretch or shift a window.
 */

export type CycleSettings = {
  durationWeeks: number
  /** 0 = Sunday … 6 = Saturday. */
  startWeekday: number
  cooldownWeeks: number
  upcomingCount: number
}

export type CycleWindow = { number: number; startsAt: Date; endsAt: Date }

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

function utcMidnight(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** The latest start weekday at 00:00 UTC that is at or before `date`. */
export function alignBack(date: Date, weekday: number) {
  const day = utcMidnight(date)
  const back = (new Date(day).getUTCDay() - weekday + 7) % 7
  return new Date(day - back * DAY_MS)
}

/** The first start weekday at 00:00 UTC that is at or after `date`. */
export function alignForward(date: Date, weekday: number) {
  const back = alignBack(date, weekday)
  return back.getTime() >= date.getTime() ? back : new Date(back.getTime() + WEEK_MS)
}

/**
 * The cycles to create so the team has a current cycle (unless it is in a cooldown)
 * and `upcomingCount` cycles that start after `now`. New cycles continue the existing
 * chain after `lastCycle` (its end plus the cooldown, aligned to the start weekday);
 * a chain that ended more than a cycle ago restarts in the current week. `upcoming`
 * is how many of the team's existing cycles start after `now`.
 */
export function nextCycleWindows(
  settings: CycleSettings,
  lastCycle: CycleWindow | null,
  now: Date,
  upcoming = 0,
): CycleWindow[] {
  const duration = settings.durationWeeks * WEEK_MS
  const cooldown = settings.cooldownWeeks * WEEK_MS
  let start = lastCycle
    ? alignForward(new Date(lastCycle.endsAt.getTime() + cooldown), settings.startWeekday)
    : alignBack(now, settings.startWeekday)
  if (start.getTime() + duration <= now.getTime()) start = alignBack(now, settings.startWeekday)

  const windows: CycleWindow[] = []
  let number = lastCycle?.number ?? 0
  let count = upcoming
  while (count < settings.upcomingCount) {
    const window = {
      number: ++number,
      startsAt: start,
      endsAt: new Date(start.getTime() + duration),
    }
    windows.push(window)
    if (start.getTime() > now.getTime()) count++
    start = alignForward(new Date(window.endsAt.getTime() + cooldown), settings.startWeekday)
  }
  return windows
}

/** The cycle running at `now` (`startsAt <= now < endsAt`), if any. */
export function currentCycle<T extends { startsAt: Date; endsAt: Date; completedAt?: Date | null }>(
  cycles: T[],
  now: Date,
): T | null {
  return (
    cycles.find(
      (cycle) =>
        !cycle.completedAt &&
        cycle.startsAt.getTime() <= now.getTime() &&
        now.getTime() < cycle.endsAt.getTime(),
    ) ?? null
  )
}

/** Zero-based day of the cycle `now` falls on, clamped to the cycle's days. */
export function cycleDayIndex(cycle: { startsAt: Date; endsAt: Date }, now: Date) {
  const days = Math.round((cycle.endsAt.getTime() - cycle.startsAt.getTime()) / DAY_MS)
  const day = Math.floor((now.getTime() - cycle.startsAt.getTime()) / DAY_MS)
  return Math.min(Math.max(day, 0), days - 1)
}

/** Writes `value` at `index`, padding missing days with `null`; returns a new array. */
export function setSnapshotPoint(snapshot: (number | null)[], index: number, value: number) {
  const next = snapshot.slice()
  while (next.length < index) next.push(null)
  next[index] = value
  return next
}
