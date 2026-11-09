import type { RealtimeEvent as ClientRealtimeEvent } from '@linear/contract'
import {
  createRealtimePublisher,
  realtimeChannel,
  realtimeEventSchema,
  userChannel,
  userEventSchema,
  userIdOfChannel,
  workspaceIdOfChannel,
  type RealtimeEvent,
  type UserEvent,
} from '@linear/queue'
import { EventPublisher } from '@orpc/server'
import type { FastifyBaseLogger } from 'fastify'
import type { Redis } from 'ioredis'

export type RealtimeHub = ReturnType<typeof createRealtimeHub>

/** What one socket's stream carries: its workspace's events plus its user's own. */
export type StreamEvent = RealtimeEvent | UserEvent

/**
 * One per API instance: publishes domain events to Redis and forwards events from
 * `workspace:<id>` and `user:<id>` channels to this instance's subscribers. A channel
 * is subscribed only while at least one local socket listens to it.
 */
export function createRealtimeHub(redis: Redis, logger: FastifyBaseLogger) {
  const publishToRedis = createRealtimePublisher(redis)
  // Subscriber connections can't run other commands; lazy so buildApp() opens nothing.
  const subscriber = redis.duplicate({ lazyConnect: true })
  // Both keyed by channel name.
  const workspaceLocal = new EventPublisher<Record<string, RealtimeEvent>>()
  const userLocal = new EventPublisher<Record<string, UserEvent>>()
  const listeners = new Map<string, number>()

  subscriber.on('message', (channel: string, message: string) => {
    const schema = workspaceIdOfChannel(channel)
      ? realtimeEventSchema
      : userIdOfChannel(channel)
        ? userEventSchema
        : null
    if (!schema) return
    const parsed = schema.safeParse(safeJson(message))
    if (!parsed.success) {
      logger.warn({ channel }, 'realtime: dropped malformed event')
      return
    }
    if (parsed.data.type === 'notification.created') userLocal.publish(channel, parsed.data)
    else workspaceLocal.publish(channel, parsed.data)
  })
  subscriber.on('error', (err) => logger.error({ err }, 'realtime: subscriber error'))

  async function retain(channel: string) {
    const count = listeners.get(channel) ?? 0
    listeners.set(channel, count + 1)
    if (count === 0) await subscriber.subscribe(channel)
  }

  async function release(channel: string) {
    const count = (listeners.get(channel) ?? 1) - 1
    if (count > 0) return listeners.set(channel, count)
    listeners.delete(channel)
    // ioredis runs commands in order, so a later retain() re-subscribes after this.
    await subscriber.unsubscribe(channel).catch(() => {})
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

    /**
     * The workspace's events plus `userId`'s own events for that workspace, until
     * `signal` aborts (the socket closed or the call ended).
     */
    async *events(workspaceId: string, userId: string, signal: AbortSignal | undefined) {
      const channels = [realtimeChannel(workspaceId), userChannel(userId)]
      // Listen locally before subscribing in Redis so nothing in between is lost.
      const merged = new EventPublisher<{ event: StreamEvent }>()
      const iterator = merged.subscribe('event', { signal, maxBufferedEvents: 200 })
      const unsubscribe = [
        workspaceLocal.subscribe(channels[0]!, (event) => merged.publish('event', event)),
        userLocal.subscribe(channels[1]!, (event) => {
          if (event.workspaceId === workspaceId) merged.publish('event', event)
        }),
      ]
      await Promise.all(channels.map(retain))
      try {
        yield* iterator
      } finally {
        for (const off of unsubscribe) off()
        await iterator.return(undefined)
        await Promise.all(channels.map(release))
      }
    },

    close() {
      subscriber.disconnect()
    },
  }
}

/**
 * The client DTO: the bus event without its internal `originId` (and a user event without
 * its routing `workspaceId`). Typed against the contract, so the schemas can't drift apart.
 */
export function toClientEvent(event: StreamEvent): ClientRealtimeEvent {
  if (event.type === 'notification.created') {
    return { type: event.type, notificationId: event.notificationId }
  }
  const { originId: _, ...rest } = event
  return rest
}

function safeJson(message: string): unknown {
  try {
    return JSON.parse(message)
  } catch {
    return null
  }
}
