import { activityLog, issues, type DbOrTx } from '@linear/db'
import { and, asc, eq, gt } from 'drizzle-orm'
import { assertCursor } from '../cursor'
import { DomainError } from '../errors'
import type { ActivityChange } from './diff'

/** Who made a change. GitHub automation has no user behind it, only the PR that triggered it. */
export type ActivityActor = { type: 'user'; id: string } | { type: 'github'; pullRequestId: string }

export type ListActivityInput = {
  workspaceId: string
  issueId: string
  cursor?: string | null
  limit: number
}

export type ActivityRecord = typeof activityLog.$inferSelect
export type RecordedActivity = Pick<ActivityRecord, 'id' | 'kind'>

/**
 * Call inside the transaction that made the changes, so both commit or neither does.
 * Returns the new entries' ids (notifications use them as their source).
 */
export async function recordActivity(
  tx: DbOrTx,
  input: { workspaceId: string; issueId: string; actor: ActivityActor; changes: ActivityChange[] },
): Promise<RecordedActivity[]> {
  if (input.changes.length === 0) return []
  const { actor } = input
  const actorId = actor.type === 'user' ? actor.id : null
  const pullRequestId = actor.type === 'github' ? actor.pullRequestId : null
  return tx
    .insert(activityLog)
    .values(
      input.changes.map((change) => ({
        workspaceId: input.workspaceId,
        issueId: input.issueId,
        actorType: actor.type,
        actorId,
        pullRequestId,
        ...change,
      })),
    )
    .returning({ id: activityLog.id, kind: activityLog.kind })
}

/**
 * Oldest first, so the timeline reads top to bottom. Ids are UUIDv7 and the
 * entries of one write are inserted in order, so paging by id keeps that order
 * and new entries only ever append to the last page.
 */
export async function listActivity(db: DbOrTx, input: ListActivityInput) {
  assertCursor(input.cursor)
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, input.workspaceId), eq(issues.id, input.issueId)))
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')

  const rows = await db
    .select()
    .from(activityLog)
    .where(
      and(
        eq(activityLog.workspaceId, input.workspaceId),
        eq(activityLog.issueId, issue.id),
        input.cursor ? gt(activityLog.id, input.cursor) : undefined,
      ),
    )
    .orderBy(asc(activityLog.id))
    .limit(input.limit + 1)
  const items = rows.slice(0, input.limit)
  const nextCursor = rows.length > input.limit ? (items.at(-1)?.id ?? null) : null
  return { items, nextCursor }
}
