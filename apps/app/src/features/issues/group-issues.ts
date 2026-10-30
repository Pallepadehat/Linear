import type { Issue, StatusCategory, WorkflowStatus } from '@linear/contract'

// Active work first, like Linear's list view; finished work sinks to the bottom.
const CATEGORY_ORDER: Record<StatusCategory, number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  canceled: 4,
}

export type IssueGroup = { key: string; status: WorkflowStatus; issues: Issue[] }

export type IssueListRow =
  | { type: 'group'; key: string; group: IssueGroup }
  | { type: 'issue'; key: string; issue: Issue }

/**
 * Groups issues by status. Keyed by category + name rather than status id so the
 * workspace-wide list merges each team's "Todo" into one group.
 */
export function groupIssuesByStatus(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  for (const issue of issues) {
    const key = `${issue.status.category}:${issue.status.name}`
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

/** Flattens groups into header + issue rows for the virtualizer. */
export function toListRows(groups: IssueGroup[]): IssueListRow[] {
  return groups.flatMap((group): IssueListRow[] => [
    { type: 'group', key: `group:${group.key}`, group },
    ...group.issues.map((issue): IssueListRow => ({ type: 'issue', key: issue.id, issue })),
  ])
}
