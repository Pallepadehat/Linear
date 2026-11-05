import {
  REALTIME_CLIENT_ID_HEADER,
  realtimeClientIdSchema,
  type PresenceEntry,
} from '@linear/contract'
import { issueExistsInWorkspace, listMembers } from '@linear/core'
import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'

const inWorkspace = requireWorkspace()

// docs/domain.md → Presence.
export const presenceRouter = {
  heartbeat: authed.presence.heartbeat
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { connection, presence, realtime, workspace, user } = context
      // Only sockets subscribed to this workspace; anything else is dropped silently.
      if (!connection?.workspaces.has(workspace.id)) return
      if (
        input.viewingIssueId &&
        !(await issueExistsInWorkspace(context.db, workspace.id, input.viewingIssueId))
      ) {
        return
      }

      const announce = () =>
        realtime.publish(workspace.id, {
          type: 'presence.changed',
          userId: user.id,
          originId: null,
        })

      if (!connection.present.has(workspace.id)) {
        connection.present.add(workspace.id)
        connection.onClose(async () => {
          if (await presence.disconnect(workspace.id, user.id, connection.id)) await announce()
        })
      }

      const changed = await presence.heartbeat(workspace.id, user.id, connection.id, {
        state: input.state,
        viewingIssueId: input.viewingIssueId,
      })
      if (changed) await announce()
    }),

  // Ephemeral "is writing a comment" signal; same WebSocket-only rules as the heartbeat.
  typing: authed.presence.typing
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context, input }) => {
      const { connection, realtime, workspace, user } = context
      if (!connection?.workspaces.has(workspace.id)) return
      if (!(await issueExistsInWorkspace(context.db, workspace.id, input.issueId))) return
      // The sender's own tab skips the echo; their other tabs ignore their own user id.
      const clientId = realtimeClientIdSchema.safeParse(
        context.headers.get(REALTIME_CLIENT_ID_HEADER),
      )
      await realtime.publish(workspace.id, {
        type: 'comment.typing',
        issueId: input.issueId,
        userId: user.id,
        typing: input.typing,
        originId: clientId.success ? clientId.data : null,
      })
    }),

  list: authed.presence.list
    .use(inWorkspace, (input) => input.workspaceSlug)
    .handler(async ({ context }) => {
      const { online, seen, expired } = await context.presence.list(context.workspace.id)
      // Pruned on read: tell everyone those users went offline.
      for (const userId of expired) {
        await context.realtime.publish(context.workspace.id, {
          type: 'presence.changed',
          userId,
          originId: null,
        })
      }
      // Current members only: a removed member's leftover entry is never returned.
      const members = await listMembers(context.db, context.workspace.id)
      return members.flatMap(({ userId }): PresenceEntry[] => {
        const live = online.get(userId)
        const lastSeenAt = seen.get(userId) ?? null
        if (live) return [{ userId, ...live, lastSeenAt }]
        if (lastSeenAt) return [{ userId, state: 'offline', viewingIssueId: null, lastSeenAt }]
        return []
      })
    }),
}
