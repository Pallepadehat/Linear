import { eventIterator, oc } from '@orpc/contract'
import { realtimeEventSchema, subscribeRealtimeInputSchema } from '../schemas/realtime'

export const realtimeContract = {
  // A long-lived stream over the WebSocket at /rpc/ws; members only (requireWorkspace).
  subscribe: oc.input(subscribeRealtimeInputSchema).output(eventIterator(realtimeEventSchema)),
}
