import {
  archiveNotification,
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  snoozeNotification,
} from '@linear/core'
import { imageUrl } from '../../lib/upload-urls'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'

const inWorkspace = requireWorkspace()

const ownerOf = (context: { workspace: { id: string }; user: { id: string } }) => ({
  workspaceId: context.workspace.id,
  userId: context.user.id,
})

// Personal to the signed-in user in the current workspace (docs/domain.md → Notifications).
export const notificationsRouter = {
  list: authed.notifications.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const page = await listNotifications(context.db, ownerOf(context), input)
      // One URL per distinct avatar per page.
      const uploadIds = [...new Set(page.items.map((n) => n.actor.avatarUploadId))]
      const urls = new Map(
        await Promise.all(
          uploadIds.map(
            async (id) => [id, await imageUrl(context.db, context.storage, id)] as const,
          ),
        ),
      )
      return {
        items: page.items.map(({ actor: { avatarUploadId, ...actor }, ...item }) => ({
          ...item,
          actor: { ...actor, avatarUrl: urls.get(avatarUploadId) ?? null },
        })),
        nextCursor: page.nextCursor,
      }
    }),

  unreadCount: authed.notifications.unreadCount
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) => ({
      count: await countUnreadNotifications(context.db, ownerOf(context)),
    })),

  markRead: authed.notifications.markRead
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(({ context, input }) => markNotificationRead(context.db, ownerOf(context), input.id)),

  markUnread: authed.notifications.markUnread
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(({ context, input }) =>
      markNotificationUnread(context.db, ownerOf(context), input.id),
    ),

  markAllRead: authed.notifications.markAllRead
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) => ({
      count: await markAllNotificationsRead(context.db, ownerOf(context)),
    })),

  snooze: authed.notifications.snooze
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(({ context, input }) =>
      snoozeNotification(context.db, ownerOf(context), input.id, input.until),
    ),

  archive: authed.notifications.archive
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(({ context, input }) => archiveNotification(context.db, ownerOf(context), input.id)),
}
