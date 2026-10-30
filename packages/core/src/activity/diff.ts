import type { activityKind } from '@linear/db'

export type ActivityKind = (typeof activityKind.enumValues)[number]
export type ActivityValue = string | number | string[] | null

export type ActivityChange = { kind: ActivityKind; from: ActivityValue; to: ActivityValue }

/** The issue fields that are tracked in the activity log. */
export type IssueSnapshot = {
  title: string
  description: string | null
  statusId: string
  priority: number
  assigneeId: string | null
  projectId: string | null
  labelIds: string[]
}

const SCALAR_FIELDS = [
  ['title', 'title'],
  ['status', 'statusId'],
  ['priority', 'priority'],
  ['assignee', 'assigneeId'],
  ['project', 'projectId'],
] as const satisfies readonly (readonly [ActivityKind, keyof IssueSnapshot])[]

/**
 * One change per field in `next` whose value differs from `current`; fields
 * set to the value they already had produce nothing. Description changes are
 * recorded without their text, and labels compare as sets.
 */
export function diffIssue(current: IssueSnapshot, next: Partial<IssueSnapshot>): ActivityChange[] {
  const changes: ActivityChange[] = []
  for (const [kind, field] of SCALAR_FIELDS) {
    const to = next[field]
    if (to !== undefined && to !== current[field]) {
      changes.push({ kind, from: current[field], to })
    }
  }
  if (next.description !== undefined && next.description !== current.description) {
    changes.push({ kind: 'description', from: null, to: null })
  }
  if (next.labelIds !== undefined) {
    const from = [...new Set(current.labelIds)].sort()
    const to = [...new Set(next.labelIds)].sort()
    if (from.join() !== to.join()) changes.push({ kind: 'labels', from, to })
  }
  return changes
}
