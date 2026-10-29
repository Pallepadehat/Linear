import { Redis } from 'ioredis'

/**
 * BullMQ workers need `maxRetriesPerRequest: null` so blocking commands survive
 * reconnects; queues use the same settings for simplicity.
 */
export function createRedisConnection(url: string) {
  return new Redis(url, { maxRetriesPerRequest: null })
}
