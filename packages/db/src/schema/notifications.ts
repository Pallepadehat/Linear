import { index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { activityActorType } from './activity'
import { users } from './auth'
import { id, timestamps } from './columns'
import { issues } from './issues'
import { workspaces } from './workspaces'

export const notificationType = pgEnum('notification_type', [
  'assigned',
  'mentioned',
  'commented',
  'status_changed',
  'pr_linked',
  'issue_created_in_team',
])

/**
 * A DTO-safe summary of what happened, by type (ids and small display values only, never rows).
 * Display names are resolved when the notification is read.
 */
export type NotificationPayload = {
  fromStatusId?: string | null
  toStatusId?: string | null
  commentId?: string
  pullRequestId?: string
  pullRequestNumber?: number
}

/** One Inbox entry for one user (docs/domain.md → Notifications). */
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: notificationType().notNull(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    actorType: activityActorType().notNull(),
    // Null for GitHub, and for users that were deleted later.
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    // What caused it (activity / comment / delivery id); the job's idempotency guard.
    sourceKey: text().notNull(),
    payload: jsonb().$type<NotificationPayload>().notNull().default({}),
    readAt: timestamp({ withTimezone: true }),
    snoozedUntil: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('notifications_user_id_source_key_unique').on(t.userId, t.sourceKey),
    index().on(t.userId, t.workspaceId, t.createdAt.desc()),
    index().on(t.issueId),
  ],
)
