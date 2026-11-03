import type { Issue, StatusCategory, WorkflowStatus } from '@linear/contract'
import { statusGroupKey } from './group-issues'

// Columns read left to right through the workflow, like Linear's board.
const WORKFLOW_ORDER: Record<StatusCategory, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  canceled: 4,
}

export type BoardColumn = { key: string; status: WorkflowStatus; issues: Issue[] }

/**
 * One column per status, in workflow order. Same-named statuses of different
 * teams share a column (the workspace-wide board), and every known status gets
 * a column even while empty so cards can be dropped into it. Issues keep their
 * list order within a column.
 */
export function toBoardColumns(
  issues: Issue[],
  statusesByTeam: ReadonlyMap<string, WorkflowStatus[]>,
): BoardColumn[] {
  const columns = new Map<string, BoardColumn>()
  const add = (status: WorkflowStatus) => {
    const key = statusGroupKey(status)
    let column = columns.get(key)
    if (!column) columns.set(key, (column = { key, status, issues: [] }))
    return column
  }
  for (const statuses of statusesByTeam.values()) statuses.forEach(add)
  // A status the team list doesn't know yet (still loading) still gets its column.
  for (const issue of issues) add(issue.status).issues.push(issue)
  return [...columns.values()].sort(
    (a, b) =>
      WORKFLOW_ORDER[a.status.category] - WORKFLOW_ORDER[b.status.category] ||
      a.status.position - b.status.position,
  )
}

export type DropTarget =
  { type: 'move'; status: WorkflowStatus } | { type: 'same' } | { type: 'unavailable' }

/**
 * The status an issue moves to when dropped on a column: its own team's status
 * with the column's name and category. A team without that status can't take
 * the drop; `undefined` statuses mean the team's statuses haven't loaded yet.
 */
export function resolveDropTarget(
  issue: Issue,
  columnKey: string,
  teamStatuses: WorkflowStatus[] | undefined,
): DropTarget {
  if (statusGroupKey(issue.status) === columnKey) return { type: 'same' }
  const status = teamStatuses?.find((s) => statusGroupKey(s) === columnKey)
  return status ? { type: 'move', status } : { type: 'unavailable' }
}

/** Issue identifiers in board order as rendered: column by column, top to bottom. */
export const boardOrder = (
  issues: Issue[],
  statusesByTeam: ReadonlyMap<string, WorkflowStatus[]>,
) =>
  toBoardColumns(issues, statusesByTeam).flatMap((column) =>
    column.issues.map((issue) => issue.identifier),
  )
