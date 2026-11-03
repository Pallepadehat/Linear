import type { ProjectProgressReport } from '@linear/contract'

// Geometry for the project Progress card (docs/domain.md → Project progress). Coordinates
// are fractions of the plot (x 0 → 1 left to right, y 0 → 1 top to bottom) so the SVG can
// stretch to any width; the component scales them to its viewBox.

export type ProgressPoint = ProjectProgressReport['series'][number]

const DAY_MS = 24 * 60 * 60 * 1000
/** The x axis spans at least this many days, so a new project isn't one squeezed column. */
const MIN_SPAN_DAYS = 7

/** Days since the epoch for a `YYYY-MM-DD` calendar day (no time zone involved). */
export function dayNumber(day: string): number {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

export function dayFromNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Where completion lands by the target date at the pace so far: completed issues per day
 * between the first and last point, carried forward from today and capped at today's
 * scope. Null without a future target date or at least two days of history.
 */
export function projectCompletion(series: ProgressPoint[], targetDate: string | null) {
  const first = series[0]
  const today = series.at(-1)
  if (!first || !today || !targetDate) return null
  const elapsed = dayNumber(today.date) - dayNumber(first.date)
  const remaining = dayNumber(targetDate) - dayNumber(today.date)
  if (elapsed <= 0 || remaining <= 0) return null
  const rate = Math.max(0, (today.completed - first.completed) / elapsed)
  return { date: targetDate, completed: Math.min(today.scope, today.completed + rate * remaining) }
}

export type ProgressChart = {
  start: string
  end: string
  /** Each point's x, aligned with `series`. */
  xs: number[]
  /** Upper edge of each band, as `x,y` pairs; areas close down to the baseline. */
  scopeLine: string
  startedLine: string
  completedLine: string
  scopeArea: string
  startedArea: string
  completedArea: string
  /** Today's x (the last point). */
  todayX: number
  projection: { x1: number; y1: number; x2: number; y2: number } | null
  /** y for a count, for the hover markers. */
  y: (count: number) => number
}

/**
 * The chart's shapes. Bands are stacked: completed at the bottom, started on top of it,
 * scope as the outline, so the gap between started and scope is the work not yet begun.
 */
export function buildProgressChart(
  series: ProgressPoint[],
  targetDate: string | null,
  width: number,
  height: number,
): ProgressChart | null {
  const today = series.at(-1)
  if (!today) return null
  const first = dayNumber(series[0]!.date)
  const last = dayNumber(today.date)
  const target = targetDate ? dayNumber(targetDate) : -Infinity
  const end = Math.max(last, target)
  const start = Math.min(first, end - MIN_SPAN_DAYS)
  const projected = projectCompletion(series, targetDate)
  const top = Math.max(1, ...series.map((p) => p.scope))

  const x = (date: string) => ((dayNumber(date) - start) / (end - start)) * width
  const y = (count: number) => height - (count / top) * height
  const xs = series.map((p) => x(p.date))
  const line = (values: number[]) =>
    values.map((v, i) => `${round(xs[i]!)},${round(y(v))}`).join(' ')
  const area = (values: number[]) =>
    `${round(xs[0]!)},${height} ${line(values)} ${round(xs.at(-1)!)},${height}`

  return {
    start: dayFromNumber(start),
    end: dayFromNumber(end),
    xs,
    scopeLine: line(series.map((p) => p.scope)),
    startedLine: line(series.map((p) => p.completed + p.started)),
    completedLine: line(series.map((p) => p.completed)),
    scopeArea: area(series.map((p) => p.scope)),
    startedArea: area(series.map((p) => p.completed + p.started)),
    completedArea: area(series.map((p) => p.completed)),
    todayX: x(today.date),
    projection: projected
      ? {
          x1: x(today.date),
          y1: y(today.completed),
          x2: x(projected.date),
          y2: y(projected.completed),
        }
      : null,
    y,
  }
}

/** Index of the point nearest to `x` (points are in date order). */
export function nearestPoint(xs: number[], x: number): number {
  let best = 0
  for (let i = 1; i < xs.length; i++) {
    if (Math.abs(xs[i]! - x) < Math.abs(xs[best]! - x)) best = i
  }
  return best
}

/** "67% of 3"; an empty group reads "0% of 0". */
export function doneLabel({ done, total }: { done: number; total: number }) {
  return `${total ? Math.round((done / total) * 100) : 0}% of ${total}`
}

function round(n: number) {
  return Math.round(n * 100) / 100
}
