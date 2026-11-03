import {
  activityLog,
  comments,
  issueSubscriptions,
  issues,
  notifications,
  pullRequests,
  teamMembers,
  teams,
  users,
  workflowStatuses,
  workspaceMembers,
  type DbOrTx,
  type NotificationPayload,
} from '@linear/db'
import { and, count, desc, eq, inArray, isNull, lt, lte, or, type SQL } from 'drizzle-orm'
import { assertCursor } from '../cursor'
import { DomainError } from '../errors'
import {
  notificationSummary,
  recipientsFor,
  targetsOf,
  type NotificationEvent,
  type NotificationType,
} from './recipients'
import { isValidSnoozeUntil } from './snooze'

/** A `notify` job (the payload schema lives in packages/queue) plus its source key. */
export type NotifyInput = {
  workspaceId: string
  issueId: string
  event: NotificationType
  actorId: string | null
  activityId?: string
  commentId?: string
  deliveryId?: string
  pullRequestId?: string
  userIds?: string[]
  sourceKey: string
}

/** Whose Inbox, in which workspace; every query filters by both. */
export type NotificationOwner = { workspaceId: string; userId: string }

type Resolved = { event: NotificationEvent; payload: NotificationPayload } | null

async function activityOf(db: DbOrTx, input: NotifyInput, kind: 'assignee' | 'status') {
  if (!input.activityId) return null
  const [row] = await db
    .select({ from: activityLog.from, to: activityLog.to })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.workspaceId, input.workspaceId),
        eq(activityLog.issueId, input.issueId),
        eq(activityLog.id, input.activityId),
        eq(activityLog.kind, kind),
      ),
    )
  return row ?? null
}

const asId = (value: unknown) => (typeof value === 'string' ? value : null)

/** Reloads what the event refers to; null when it's gone (nothing to notify about). */
async function resolveEvent(
  db: DbOrTx,
  input: NotifyInput,
  issue: { teamId: string; assigneeId: string | null },
): Promise<Resolved> {
  switch (input.event) {
    case 'assigned': {
      const assigneeId = asId((await activityOf(db, input, 'assignee'))?.to)
      return assigneeId ? { event: { type: 'assigned', assigneeId }, payload: {} } : null
    }
    case 'status_changed': {
      const row = await activityOf(db, input, 'status')
      if (!row) return null
      return {
        event: { type: 'status_changed' },
        payload: { fromStatusId: asId(row.from), toStatusId: asId(row.to) },
      }
    }
    case 'commented':
    case 'mentioned': {
      if (input.commentId) {
        const [comment] = await db
          .select({ id: comments.id })
          .from(comments)
          .where(
            and(
              eq(comments.workspaceId, input.workspaceId),
              eq(comments.issueId, input.issueId),
              eq(comments.id, input.commentId),
            ),
          )
        if (!comment) return null
      }
      const payload = input.commentId ? { commentId: input.commentId } : {}
      return input.event === 'commented'
        ? { event: { type: 'commented' }, payload }
        : { event: { type: 'mentioned', userIds: input.userIds ?? [] }, payload }
    }
    case 'pr_linked': {
      if (!input.pullRequestId) return null
      const [pr] = await db
        .select({ id: pullRequests.id, number: pullRequests.number })
        .from(pullRequests)
        .where(
          and(
            eq(pullRequests.workspaceId, input.workspaceId),
            eq(pullRequests.id, input.pullRequestId),
          ),
        )
      if (!pr) return null
      return {
        event: { type: 'pr_linked' },
        payload: { pullRequestId: pr.id, pullRequestNumber: pr.number },
      }
    }
    case 'issue_created_in_team': {
      const rows = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(
          and(eq(teamMembers.workspaceId, input.workspaceId), eq(teamMembers.teamId, issue.teamId)),
        )
      // The assignee hears about it through `assigned` instead.
      const teamMemberIds = rows.map((r) => r.userId).filter((id) => id !== issue.assigneeId)
      return { event: { type: 'issue_created_in_team', teamMemberIds }, payload: {} }
    }
  }
}

/**
 * Runs one `notify` job: works out the recipients and inserts one notification each.
 * Idempotent: `(userId, sourceKey)` is unique, so a rerun inserts nothing new.
 * Returns the notifications it created (to publish `notification.created`).
 */
export async function createNotifications(db: DbOrTx, input: NotifyInput) {
  const [issue] = await db
    .select({ teamId: issues.teamId, assigneeId: issues.assigneeId })
    .from(issues)
    .where(and(eq(issues.workspaceId, input.workspaceId), eq(issues.id, input.issueId)))
  if (!issue) return []
  const resolved = await resolveEvent(db, input, issue)
  if (!resolved) return []

  const subscribers = (
    await db
      .select({ userId: issueSubscriptions.userId })
      .from(issueSubscriptions)
      .where(
        and(
          eq(issueSubscriptions.workspaceId, input.workspaceId),
          eq(issueSubscriptions.issueId, input.issueId),
        ),
      )
  ).map((r) => r.userId)
  const candidates = [...new Set(targetsOf(resolved.event, subscribers))]
  if (candidates.length === 0) return []
  const members = new Set(
    (
      await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, input.workspaceId),
            inArray(workspaceMembers.userId, candidates),
          ),
        )
    ).map((r) => r.userId),
  )
  const recipients = recipientsFor(resolved.event, subscribers, input.actorId, members)
  if (recipients.length === 0) return []

  return db
    .insert(notifications)
    .values(
      recipients.map((userId) => ({
        userId,
        workspaceId: input.workspaceId,
        type: input.event,
        issueId: input.issueId,
        actorType: input.actorId ? ('user' as const) : ('github' as const),
        actorId: input.actorId,
        sourceKey: input.sourceKey,
        payload: resolved.payload,
      })),
    )
    .onConflictDoNothing({ target: [notifications.userId, notifications.sourceKey] })
    .returning({ id: notifications.id, userId: notifications.userId })
}

const ownedBy = (owner: NotificationOwner) =>
  and(eq(notifications.workspaceId, owner.workspaceId), eq(notifications.userId, owner.userId))

/** In the Inbox: not archived, and not snoozed (or the snooze has ended). */
const visible = (owner: NotificationOwner, now: Date) =>
  and(
    ownedBy(owner),
    isNull(notifications.archivedAt),
    or(isNull(notifications.snoozedUntil), lte(notifications.snoozedUntil, now)),
  )

export type NotificationRecord = Awaited<ReturnType<typeof listNotifications>>['items'][number]

/** Newest first, paged by id; each row carries what the Inbox renders. */
export async function listNotifications(
  db: DbOrTx,
  owner: NotificationOwner,
  input: { filter: 'unread' | 'all'; cursor?: string | null; limit: number; now?: Date },
) {
  assertCursor(input.cursor)
  const now = input.now ?? new Date()
  let after: SQL | undefined
  if (input.cursor) {
    const [cursor] = await db
      .select({ createdAt: notifications.createdAt })
      .from(notifications)
      .where(and(ownedBy(owner), eq(notifications.id, input.cursor)))
    if (!cursor) throw new DomainError('BAD_REQUEST', 'Invalid cursor')
    after = or(
      lt(notifications.createdAt, cursor.createdAt),
      and(eq(notifications.createdAt, cursor.createdAt), lt(notifications.id, input.cursor)),
    )
  }
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      payload: notifications.payload,
      readAt: notifications.readAt,
      snoozedUntil: notifications.snoozedUntil,
      createdAt: notifications.createdAt,
      actorType: notifications.actorType,
      actorId: notifications.actorId,
      actorName: users.name,
      actorAvatarUploadId: users.avatarUploadId,
      issueId: issues.id,
      issueNumber: issues.number,
      issueTitle: issues.title,
      teamKey: teams.key,
      status: {
        id: workflowStatuses.id,
        name: workflowStatuses.name,
        category: workflowStatuses.category,
        position: workflowStatuses.position,
      },
    })
    .from(notifications)
    .innerJoin(
      issues,
      and(eq(issues.id, notifications.issueId), eq(issues.workspaceId, owner.workspaceId)),
    )
    .innerJoin(teams, eq(teams.id, issues.teamId))
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(
      and(
        visible(owner, now),
        input.filter === 'unread' ? isNull(notifications.readAt) : undefined,
        after,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(input.limit + 1)
  const page = rows.slice(0, input.limit)

  // Status names for "changed status to …"; a deleted status just drops the name.
  const statusIds = [...new Set(page.flatMap((r) => r.payload.toStatusId ?? []))]
  const statusNames = new Map(
    statusIds.length === 0
      ? []
      : (
          await db
            .select({ id: workflowStatuses.id, name: workflowStatuses.name })
            .from(workflowStatuses)
            .where(
              and(
                eq(workflowStatuses.workspaceId, owner.workspaceId),
                inArray(workflowStatuses.id, statusIds),
              ),
            )
        ).map((s) => [s.id, s.name]),
  )

  const items = page.map((r) => ({
    id: r.id,
    type: r.type,
    actor: {
      type: r.actorType,
      id: r.actorId,
      name: r.actorName,
      avatarUploadId: r.actorAvatarUploadId,
    },
    issue: {
      id: r.issueId,
      identifier: `${r.teamKey}-${r.issueNumber}`,
      title: r.issueTitle,
      status: r.status,
    },
    summary: notificationSummary({
      type: r.type,
      actorType: r.actorType,
      actorName: r.actorName,
      toStatusName: r.payload.toStatusId ? statusNames.get(r.payload.toStatusId) : null,
      pullRequestNumber: r.payload.pullRequestNumber,
    }),
    readAt: r.readAt,
    snoozedUntil: r.snoozedUntil,
    createdAt: r.createdAt,
  }))
  const nextCursor = rows.length > input.limit ? (page.at(-1)?.id ?? null) : null
  return { items, nextCursor }
}

/** Unread notifications currently in the Inbox (the sidebar badge). */
export async function countUnreadNotifications(
  db: DbOrTx,
  owner: NotificationOwner,
  now = new Date(),
) {
  const [row] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(visible(owner, now), isNull(notifications.readAt)))
  return row?.count ?? 0
}

/** Updates one of the owner's notifications; anyone else's (or a missing one) is NOT_FOUND. */
async function updateOwn(
  db: DbOrTx,
  owner: NotificationOwner,
  id: string,
  set: Partial<typeof notifications.$inferInsert>,
) {
  const [row] = await db
    .update(notifications)
    .set(set)
    .where(and(ownedBy(owner), eq(notifications.id, id)))
    .returning({ id: notifications.id })
  if (!row) throw new DomainError('NOT_FOUND', 'Notification not found')
  return row
}

export function markNotificationRead(db: DbOrTx, owner: NotificationOwner, id: string) {
  return updateOwn(db, owner, id, { readAt: new Date() })
}

export function markNotificationUnread(db: DbOrTx, owner: NotificationOwner, id: string) {
  return updateOwn(db, owner, id, { readAt: null })
}

export function archiveNotification(db: DbOrTx, owner: NotificationOwner, id: string) {
  return updateOwn(db, owner, id, { archivedAt: new Date() })
}

/** Hides it until `until`; it comes back unread so the badge shows it again. */
export function snoozeNotification(db: DbOrTx, owner: NotificationOwner, id: string, until: Date) {
  if (!isValidSnoozeUntil(until)) {
    throw new DomainError('BAD_REQUEST', 'Snooze until a time in the next year')
  }
  return updateOwn(db, owner, id, { snoozedUntil: until, readAt: null })
}

/** Marks every unread notification in the Inbox read; returns how many changed. */
export async function markAllNotificationsRead(db: DbOrTx, owner: NotificationOwner) {
  const now = new Date()
  const rows = await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(visible(owner, now), isNull(notifications.readAt)))
    .returning({ id: notifications.id })
  return rows.length
}
