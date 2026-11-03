import { z } from 'zod'
import { workspaceScopedSchema } from './common'
import { workflowStatusSchema } from './teams'

// docs/domain.md → Notifications.
export const notificationTypeSchema = z.enum([
  'assigned',
  'mentioned',
  'commented',
  'status_changed',
  'pr_linked',
  'issue_created_in_team',
])

export const notificationFilterSchema = z.enum(['unread', 'all'])

/** One Inbox row, with what the list needs to render it (no follow-up fetches). */
export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  /** `github` for automation; then `id`, `name` and `avatarUrl` are null. */
  actor: z.object({
    type: z.enum(['user', 'github']),
    id: z.uuid().nullable(),
    name: z.string().nullable(),
    avatarUrl: z.url().nullable(),
  }),
  issue: z.object({
    id: z.uuid(),
    identifier: z.string(),
    title: z.string(),
    status: workflowStatusSchema,
  }),
  /** One line, e.g. "Ada assigned you" or "Ada changed status to Done". */
  summary: z.string(),
  readAt: z.date().nullable(),
  snoozedUntil: z.date().nullable(),
  createdAt: z.date(),
})

export const listNotificationsInputSchema = workspaceScopedSchema.extend({
  filter: notificationFilterSchema.default('all'),
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(50),
})

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
})

export const notificationIdInputSchema = workspaceScopedSchema.extend({ id: z.uuid() })

/**
 * `until` is computed by the client in the viewer's time zone ("Tomorrow" = 9:00 local);
 * it must be in the future and at most a year ahead.
 */
export const snoozeNotificationInputSchema = notificationIdInputSchema.extend({
  until: z.date(),
})

export type NotificationType = z.infer<typeof notificationTypeSchema>
export type NotificationFilter = z.infer<typeof notificationFilterSchema>
export type Notification = z.infer<typeof notificationSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>
