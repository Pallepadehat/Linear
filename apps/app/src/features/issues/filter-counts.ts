import type { WorkflowStatus } from '@linear/contract'
import { statusGroupKey } from './group-issues'

type FacetCount = { id: string; count: number }
type StatusName = Pick<WorkflowStatus, 'id' | 'category' | 'name'>

/** All issues a facet counts once each (statuses: every issue has exactly one). */
export const facetTotal = (counts: readonly FacetCount[] | undefined) =>
  counts?.reduce((sum, row) => sum + row.count, 0) ?? 0

/**
 * Status facet counts keyed like the list's status groups (`category:name`), so the same-named
 * statuses of several teams add up into one group. Unknown status ids are skipped.
 */
export function statusGroupCounts(
  counts: readonly FacetCount[] | undefined,
  statuses: Iterable<StatusName>,
): Map<string, number> {
  const byId = new Map([...statuses].map((status) => [status.id, status]))
  const groups = new Map<string, number>()
  for (const row of counts ?? []) {
    const status = byId.get(row.id)
    if (!status) continue
    const key = statusGroupKey(status)
    groups.set(key, (groups.get(key) ?? 0) + row.count)
  }
  return groups
}

/** "1 issue" / "3 issues hidden by filters"; null when nothing is hidden. */
export function hiddenByFiltersText(total: number, shown: number): string | null {
  const hidden = total - shown
  if (hidden <= 0) return null
  return `${hidden} ${hidden === 1 ? 'issue' : 'issues'} hidden by filters`
}
