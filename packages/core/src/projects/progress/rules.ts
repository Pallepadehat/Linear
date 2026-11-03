import type { workflowStatuses } from '@linear/db'

type StatusCategory = typeof workflowStatuses.$inferSelect.category

/** A project's issue counts on one day (docs/domain.md → Project progress). */
export type ProgressCounts = { scope: number; started: number; completed: number }
export type ProgressPoint = ProgressCounts & { date: string }

/**
 * Scope is every issue in the project (canceled ones included, like project progress);
 * started counts the `started` status category, completed the `completed` one.
 */
export function countProgress(categories: Iterable<StatusCategory>): ProgressCounts {
  const counts = { scope: 0, started: 0, completed: 0 }
  for (const category of categories) {
    counts.scope++
    if (category === 'started') counts.started++
    else if (category === 'completed') counts.completed++
  }
  return counts
}

export type BreakdownRow = { key: string | null; name: string }

/**
 * Done / total per group (an assignee or a label). Each row is one issue in one group, so
 * an issue with two labels counts under both. Sorted by total, most first; ties by name,
 * with the `null` group ("No assignee") last.
 */
export function progressBreakdown<Row extends BreakdownRow>(
  rows: Iterable<{ group: Row; category: StatusCategory }>,
): (Row & { done: number; total: number })[] {
  const groups = new Map<string | null, Row & { done: number; total: number }>()
  for (const { group, category } of rows) {
    let entry = groups.get(group.key)
    if (!entry) groups.set(group.key, (entry = { ...group, done: 0, total: 0 }))
    entry.total++
    if (category === 'completed') entry.done++
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.total - a.total ||
      Number(a.key === null) - Number(b.key === null) ||
      a.name.localeCompare(b.name),
  )
}

/**
 * The chart series: stored daily snapshots in date order, with today's point replaced by
 * the live counts, so the chart is current even before today's snapshot job runs.
 */
export function progressSeries(snapshots: ProgressPoint[], today: ProgressPoint): ProgressPoint[] {
  return [
    ...snapshots
      .filter((point) => point.date < today.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    today,
  ]
}
