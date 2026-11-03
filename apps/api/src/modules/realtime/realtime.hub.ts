import type { RealtimeEvent as ClientRealtimeEvent } from '@linear/contract'
import {
  createRealtimePublisher,
  realtimeChannel,
  realtimeEventSchema,
  workspaceIdOfChannel,
  type RealtimeEvent,
} from '@linear/queue'
import { EventPublisher } from '@orpc/server'
import type { FastifyBaseLogger } from 'fastify'
import type { Redis } from 'ioredis'

export type RealtimeHub = ReturnType<typeof createRealtimeHub>

/**
 * One per API instance: publishes domain events to Redis and forwards events from
 * `workspace:<id>` channels to this instance's subscribers. A channel is subscribed
 * only while at least one local socket listens to that workspace.
 */
export function createRealtimeHub(redis: Redis, logger: FastifyBaseLogger) {
  const publishToRedis = createRealtimePublisher(redis)
  // Subscriber connections can't run other commands; lazy so buildApp() opens nothing.
  const subscriber = redis.duplicate({ lazyConnect: true })
  const local = new EventPublisher<Record<string, RealtimeEvent>>()
  const listeners = new Map<string, number>()

  subscriber.on('message', (channel: string, message: string) => {
    const workspaceId = workspaceIdOfChannel(channel)
    if (!workspaceId) return
    const parsed = realtimeEventSchema.safeParse(safeJson(message))
    if (!parsed.success) {
      logger.warn({ channel }, 'realtime: dropped malformed event')
      return
    }
    local.publish(workspaceId, parsed.data)
  })
  subscriber.on('error', (err) => logger.error({ err }, 'realtime: subscriber error'))

  async function retain(workspaceId: string) {
    const count = listeners.get(workspaceId) ?? 0
    listeners.set(workspaceId, count + 1)
    if (count === 0) await subscriber.subscribe(realtimeChannel(workspaceId))
  }

  async function release(workspaceId: string) {
    const count = (listeners.get(workspaceId) ?? 1) - 1
    if (count > 0) return listeners.set(workspaceId, count)
    listeners.delete(workspaceId)
    // ioredis runs commands in order, so a later retain() re-subscribes after this.
    await subscriber.unsubscribe(realtimeChannel(workspaceId)).catch(() => {})
  }

  return {
    /**
     * Never throws: realtime is best effort and must not fail a committed change.
     * Clients resync on reconnect, so a lost event heals on the next refetch.
     */
    async publish(workspaceId: string, event: RealtimeEvent) {
      try {
        await publishToRedis(workspaceId, event)
      } catch (err) {
        logger.error({ err, type: event.type }, 'realtime: publish failed')
      }
    },

    /** The workspace's events until `signal` aborts (the socket closed or the call ended). */
    async *events(workspaceId: string, signal: AbortSignal | undefined) {
      // Listen locally before subscribing in Redis so nothing in between is lost.
      const iterator = local.subscribe(workspaceId, { signal, maxBufferedEvents: 200 })
      await retain(workspaceId)
      try {
        yield* iterator
      } finally {
        await iterator.return(undefined)
        await release(workspaceId)
      }
    },

    close() {
      subscriber.disconnect()
    },
  }
}

/**
 * The client DTO: the bus event without its internal `originId`. Typed against the
 * contract, so the two schemas can't drift apart silently.
 */
export function toClientEvent({ originId: _, ...event }: RealtimeEvent): ClientRealtimeEvent {
  return event
}

function safeJson(message: string): unknown {
  try {
    return JSON.parse(message)
  } catch {
    return null
  }
}
