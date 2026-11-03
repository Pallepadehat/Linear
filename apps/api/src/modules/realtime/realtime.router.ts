import { authed } from '../../orpc/base'
import { requireWorkspace } from '../../orpc/middleware/require-workspace'
import { toClientEvent } from './realtime.hub'

export const realtimeRouter = {
  // Membership is checked before the first event; non-members get NOT_FOUND like
  // every other workspace procedure, so they never see a single event.
  subscribe: authed.realtime.subscribe
    .use(requireWorkspace(), (input) => input.workspaceSlug)
    .handler(async function* ({ context, input, signal }) {
      for await (const event of context.realtime.events(context.workspace.id, signal)) {
        // The tab that made the change already applied it optimistically.
        if (input.clientId && event.originId === input.clientId) continue
        yield toClientEvent(event)
      }
    }),
}
