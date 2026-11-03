import type { Issue, StatusCategory, WorkflowStatus } from '@linear/contract'

// Active work first, like Linear's list view; finished work sinks to the bottom.
export const CATEGORY_ORDER: Record<StatusCategory, number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  canceled: 4,
}

export type IssueGroup = { key: string; status: WorkflowStatus; issues: Issue[] }

export type IssueListRow =
  | { type: 'group'; key: string; group: IssueGroup }
  | { type: 'issue'; key: string; issue: Issue; depth: number }

/** Groups the same-named status of different teams together (e.g. every team's "Todo"). */
export const statusGroupKey = (status: Pick<WorkflowStatus, 'category' | 'name'>) =>
  `${status.category}:${status.name}`

/**
 * Groups issues by status. Keyed by category + name rather than status id so the
 * workspace-wide list merges each team's "Todo" into one group.
 */
export function groupIssuesByStatus(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  for (const issue of issues) {
    const key = statusGroupKey(issue.status)
    const group = groups.get(key)
    if (group) group.issues.push(issue)
    else groups.set(key, { key, status: issue.status, issues: [issue] })
  }
  return [...groups.values()].sort(
    (a, b) =>
      CATEGORY_ORDER[a.status.category] - CATEGORY_ORDER[b.status.category] ||
      a.status.position - b.status.position,
  )
}

/**
 * Puts each sub-issue right after its parent (depth + 1) when the parent is in the
 * same list, keeping the list's order among siblings. Sub-issues whose parent isn't
 * there (another group, not loaded, filtered out) stay at the top level.
 */
export function nestSubIssues(issues: Issue[]): { issue: Issue; depth: number }[] {
  const ids = new Set(issues.map((issue) => issue.id))
  const children = new Map<string, Issue[]>()
  for (const issue of issues) {
    if (!issue.parentId || !ids.has(issue.parentId)) continue
    const siblings = children.get(issue.parentId)
    if (siblings) siblings.push(issue)
    else children.set(issue.parentId, [issue])
  }
  const out: { issue: Issue; depth: number }[] = []
  const placed = new Set<string>()
  const visit = (issue: Issue, depth: number) => {
    if (placed.has(issue.id)) return
    placed.add(issue.id)
    out.push({ issue, depth })
    for (const child of children.get(issue.id) ?? []) visit(child, depth + 1)
  }
  for (const issue of issues) {
    if (!issue.parentId || !ids.has(issue.parentId)) visit(issue, 0)
  }
  // Only reachable if the data had a cycle; never drop an issue.
  for (const issue of issues) visit(issue, 0)
  return out
}

/** Flattens groups into header + issue rows for the virtualizer; collapsed groups keep only their header. */
export function toListRows(
  groups: IssueGroup[],
  collapsed: ReadonlySet<string> = new Set(),
): IssueListRow[] {
  return groups.flatMap((group): IssueListRow[] => [
    { type: 'group', key: `group:${group.key}`, group },
    ...(collapsed.has(group.key)
      ? []
      : nestSubIssues(group.issues).map(({ issue, depth }): IssueListRow => ({
          type: 'issue',
          key: issue.id,
          issue,
          depth,
        }))),
  ])
}

/** Issue identifiers in list order as rendered: by group, skipping collapsed groups. */
export const listOrder = (issues: Issue[], collapsed: ReadonlySet<string> = new Set()) =>
  toListRows(groupIssuesByStatus(issues), collapsed).flatMap((row) =>
    row.type === 'issue' ? [row.issue.identifier] : [],
  )
