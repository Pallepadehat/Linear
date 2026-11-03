import { oc } from '@orpc/contract'
import { z } from 'zod'
import { workspaceScopedSchema } from '../schemas/common'
import { presenceEntrySchema, presenceHeartbeatInputSchema } from '../schemas/realtime'

export const presenceContract = {
  // Only accepted over the realtime WebSocket, from a socket subscribed to the workspace;
  // anything else (HTTP, foreign issue) is dropped silently.
  heartbeat: oc.input(presenceHeartbeatInputSchema).output(z.void()),
  // One entry per current member with a known presence; bounded, so a plain array.
  list: oc.input(workspaceScopedSchema).output(z.array(presenceEntrySchema)),
}
