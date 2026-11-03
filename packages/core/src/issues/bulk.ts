import { issueLabels, issues, type DbOrTx } from '@linear/db'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { ActivityActor } from '../activity/activity.service'
import { DomainError } from '../errors'
import { deleteIssue, updateIssue } from './issues.service'

/** Properties a bulk update sets on every issue; labels are added/removed per issue. */
export type BulkIssuePatch = {
  statusId?: string
  priority?: number
  assigneeId?: string | null
  projectId?: string | null
  addLabelIds?: string[]
  removeLabelIds?: string[]
}

/** The issue's labels after adding and removing; `undefined` when the set is unchanged. */
export function nextLabelIds(current: string[], add: string[] = [], remove: string[] = []) {
  const removed = new Set(remove)
  const next = [...new Set([...current, ...add])].filter((id) => !removed.has(id))
  const unchanged = next.length === current.length && next.every((id) => current.includes(id))
  return unchanged ? undefined : next
}

/**
 * Locks the issues in a stable order (so two bulk calls can't deadlock) and checks
 * every id belongs to the workspace; one foreign or missing id fails the whole call.
 */
async function lockIssues(tx: DbOrTx, workspaceId: string, ids: string[]) {
  const rows = await tx
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), inArray(issues.id, ids)))
    .orderBy(asc(issues.id))
    .for('update')
  if (rows.length !== ids.length) throw new DomainError('NOT_FOUND', 'Issue not found')
}

/**
 * Applies `patch` to every issue in one transaction, each through `updateIssue`, so
 * status, assignee, project and labels are checked against that issue's team and
 * `completedAt`, cycles, subscriptions and activity follow the single-issue rules.
 * Any failure rolls back every issue.
 */
export async function bulkUpdateIssues(
  db: DbOrTx,
  input: { workspaceId: string; actor: ActivityActor; ids: string[]; patch: BulkIssuePatch },
) {
  const ids = [...new Set(input.ids)]
  const { addLabelIds, removeLabelIds, ...fields } = input.patch
  const touchesLabels = Boolean(addLabelIds?.length || removeLabelIds?.length)
  return db.transaction(async (tx) => {
    await lockIssues(tx, input.workspaceId, ids)
    const updated = []
    for (const id of ids) {
      let labelIds: string[] | undefined
      if (touchesLabels) {
        const current = await tx
          .select({ labelId: issueLabels.labelId })
          .from(issueLabels)
          .where(and(eq(issueLabels.workspaceId, input.workspaceId), eq(issueLabels.issueId, id)))
        labelIds = nextLabelIds(
          current.map((row) => row.labelId),
          addLabelIds,
          removeLabelIds,
        )
      }
      updated.push(
        await updateIssue(tx, {
          ...fields,
          workspaceId: input.workspaceId,
          id,
          actor: input.actor,
          labelIds,
        }),
      )
    }
    return updated
  })
}

/**
 * Deletes every issue in one transaction (all or nothing), each through
 * `deleteIssue`. Parents and sub-issues outside the batch are returned so callers
 * can notify them; the caller enqueues `delete-objects` for `deletedUploadIds`.
 */
export async function bulkDeleteIssues(db: DbOrTx, workspaceId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  return db.transaction(async (tx) => {
    await lockIssues(tx, workspaceId, unique)
    const deleted = []
    for (const id of unique) deleted.push(await deleteIssue(tx, workspaceId, id))
    const gone = new Set(unique)
    const outside = (list: (string | null)[]) => [
      ...new Set(list.filter((id): id is string => id !== null && !gone.has(id))),
    ]
    return {
      ids: unique,
      parentIds: outside(deleted.map((issue) => issue.parentId)),
      childIds: outside(deleted.flatMap((issue) => issue.childIds)),
      projectIds: [...new Set(deleted.flatMap((issue) => issue.projectId ?? []))],
      deletedUploadIds: deleted.flatMap((issue) => issue.deletedUploadIds),
    }
  })
}
