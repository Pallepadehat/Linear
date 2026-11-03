import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import {
  listNotificationsInputSchema,
  notificationIdInputSchema,
  notificationPageSchema,
  snoozeNotificationInputSchema,
} from '../schemas/notifications'

const idOutput = z.object({ id: z.uuid() })

// The signed-in user's Inbox in one workspace; another user's notification is NOT_FOUND.
export const notificationsContract = {
  /** Newest first; archived and currently snoozed notifications are left out. */
  list: oc.input(listNotificationsInputSchema).output(notificationPageSchema),
  /** Unread, not archived, not snoozed. */
  unreadCount: oc.input(workspaceScopedSchema).output(z.object({ count: z.number().int() })),
  markRead: oc.input(notificationIdInputSchema).output(idOutput),
  markUnread: oc.input(notificationIdInputSchema).output(idOutput),
  /** Marks every visible notification read; returns how many changed. */
  markAllRead: oc.input(workspaceScopedSchema).output(z.object({ count: z.number().int() })),
  snooze: oc.input(snoozeNotificationInputSchema).output(idOutput),
  archive: oc.input(notificationIdInputSchema).output(idOutput),
}
