import { issueSubscriptions, issues, users, workspaceMembers, type DbOrTx } from '@linear/db'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DomainError } from '../errors'

export type SubscriptionInput = {
  workspaceId: string
  issueId: string
  userId: string
}

/** A subscriber with what the UI needs to render their avatar. */
export type SubscriberRecord = {
  id: string
  name: string
  email: string
  avatarUploadId: string | null
}

async function assertIssue(db: DbOrTx, workspaceId: string, issueId: string) {
  const [issue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.id, issueId)))
  if (!issue) throw new DomainError('NOT_FOUND', 'Issue not found')
}

/**
 * Subscribes the users to the issue, skipping anyone who isn't a member of its
 * workspace and anyone already subscribed. Meant to run in the transaction of
 * the write that triggers it (create, assign, comment, and @mentions in M10-03),
 * so a rolled-back write never leaves a subscription behind.
 */
export async function subscribeUsers(tx: DbOrTx, issueId: string, userIds: (string | null)[]) {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return
  const [issue] = await tx
    .select({ workspaceId: issues.workspaceId })
    .from(issues)
    .where(eq(issues.id, issueId))
  if (!issue) return
  const members = await tx
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, issue.workspaceId),
        inArray(workspaceMembers.userId, unique),
      ),
    )
  if (members.length === 0) return
  await tx
    .insert(issueSubscriptions)
    .values(members.map((m) => ({ workspaceId: issue.workspaceId, issueId, userId: m.userId })))
    .onConflictDoNothing({ target: [issueSubscriptions.issueId, issueSubscriptions.userId] })
}

/** Idempotent; only workspace members can be subscribed. */
export async function subscribe(db: DbOrTx, input: SubscriptionInput) {
  await assertIssue(db, input.workspaceId, input.issueId)
  const [member] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.userId),
      ),
    )
  if (!member) throw new DomainError('BAD_REQUEST', 'User is not a member of this workspace')
  await subscribeUsers(db, input.issueId, [input.userId])
  return { subscribed: true }
}

/** Idempotent: unsubscribing someone who isn't subscribed is a no-op. */
export async function unsubscribe(db: DbOrTx, input: SubscriptionInput) {
  await assertIssue(db, input.workspaceId, input.issueId)
  await db
    .delete(issueSubscriptions)
    .where(
      and(
        eq(issueSubscriptions.workspaceId, input.workspaceId),
        eq(issueSubscriptions.issueId, input.issueId),
        eq(issueSubscriptions.userId, input.userId),
      ),
    )
  return { subscribed: false }
}

/**
 * Current members subscribed to the issue, in the order they subscribed.
 * Bounded by the workspace's member count, so not paginated.
 */
export async function listSubscribers(
  db: DbOrTx,
  workspaceId: string,
  issueId: string,
): Promise<SubscriberRecord[]> {
  await assertIssue(db, workspaceId, issueId)
  return (
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUploadId: users.avatarUploadId,
      })
      .from(issueSubscriptions)
      .innerJoin(users, eq(users.id, issueSubscriptions.userId))
      // Someone who left the workspace keeps their row but is no longer listed.
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, issueSubscriptions.workspaceId),
          eq(workspaceMembers.userId, issueSubscriptions.userId),
        ),
      )
      .where(
        and(
          eq(issueSubscriptions.workspaceId, workspaceId),
          eq(issueSubscriptions.issueId, issueId),
        ),
      )
      .orderBy(asc(issueSubscriptions.id))
  )
}
