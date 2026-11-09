import type { Issue, WorkflowStatus } from '@linear/contract'
import {
  groupIssues,
  statusGroupKey,
  type GroupContext,
  type GroupOptions,
  type IssueGroup,
} from './group-issues'
import type { IssuePatch } from './issue-cache'

export type BoardColumn = IssueGroup

/**
 * One column per group of the view's grouping, in its natural order (statuses in
 * workflow order, backlog first). Grouped by status, every known status gets a
 * column even while empty so cards can be dropped into it (within the view's
 * categories, if any); other groupings show empty columns with "Show empty groups".
 * Same-named statuses of different teams share a column. Issues keep their list
 * order within a column. Sub-grouping is a list-only option.
 */
export function toBoardColumns(
  issues: Issue[],
  ctx: GroupContext,
  options: Omit<GroupOptions, 'subGroupBy' | 'statusOrder'> = { groupBy: 'status' },
): BoardColumn[] {
  return groupIssues(
    issues,
    {
      ...options,
      subGroupBy: 'none',
      statusOrder: 'workflow',
      showEmpty: options.groupBy === 'status' || options.showEmpty,
    },
    ctx,
  )
}

export type DropTarget =
  { type: 'move'; patch: IssuePatch } | { type: 'same' } | { type: 'unavailable' }

/**
 * What an issue gets when dropped on a column. A status column moves it to its own
 * team's status with the column's name and category; a team without that status
 * can't take the drop (`undefined` statuses: not loaded yet). Priority, assignee and
 * project columns set that field; label and "No grouping" columns take no drops.
 */
export function resolveDropTarget(
  issue: Issue,
  column: Pick<BoardColumn, 'key' | 'value'>,
  teamStatuses: WorkflowStatus[] | undefined,
): DropTarget {
  const { value } = column
  switch (value.by) {
    case 'status': {
      if (statusGroupKey(issue.status) === column.key) return { type: 'same' }
      const status = teamStatuses?.find((s) => statusGroupKey(s) === column.key)
      return status ? { type: 'move', patch: { status } } : { type: 'unavailable' }
    }
    case 'priority':
      return issue.priority === value.priority
        ? { type: 'same' }
        : { type: 'move', patch: { priority: value.priority } }
    case 'assignee':
      return issue.assigneeId === value.assigneeId
        ? { type: 'same' }
        : { type: 'move', patch: { assigneeId: value.assigneeId } }
    case 'project':
      return issue.projectId === value.projectId
        ? { type: 'same' }
        : { type: 'move', patch: { projectId: value.projectId } }
    default:
      return { type: 'unavailable' }
  }
}

/** Issue identifiers in board order as rendered: column by column, top to bottom. */
export const boardOrder = (columns: BoardColumn[]) => {
  const seen = new Set<string>()
  return columns.flatMap((column) =>
    column.issues.flatMap((issue) => {
      if (seen.has(issue.id)) return []
      seen.add(issue.id)
      return [issue.identifier]
    }),
  )
}
