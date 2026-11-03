import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import type { RealtimeConnection } from './connection'
import { toClientEvent, type RealtimeHub } from './realtime.hub'

export const realtimeRouter = {
  // Membership is checked before the first event; non-members get NOT_FOUND like
  // every other workspace procedure, so they never see a single event.
  subscribe: authed.realtime.subscribe
    .use(requireWorkspace(), (input) => input.workspaceSlug)
    .handler(async ({ context, input, signal }) => {
      const { connection, workspace } = context
      // Registered before the stream starts (a generator body runs lazily), so a
      // heartbeat sent right after subscribing is already accepted.
      connection?.workspaces.set(workspace.id, (connection.workspaces.get(workspace.id) ?? 0) + 1)
      return stream(context.realtime, connection, workspace.id, input.clientId, signal)
    }),
}

async function* stream(
  realtime: RealtimeHub,
  connection: RealtimeConnection | undefined,
  workspaceId: string,
  clientId: string | undefined,
  signal: AbortSignal | undefined,
) {
  try {
    for await (const event of realtime.events(workspaceId, signal)) {
      // The tab that made the change already applied it optimistically.
      if (clientId && event.originId === clientId) continue
      yield toClientEvent(event)
    }
  } finally {
    // Heartbeats for this workspace stop being accepted once no stream is left.
    const count = (connection?.workspaces.get(workspaceId) ?? 1) - 1
    if (count > 0) connection?.workspaces.set(workspaceId, count)
    else connection?.workspaces.delete(workspaceId)
  }
}
