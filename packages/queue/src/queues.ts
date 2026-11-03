import { Queue, type JobsOptions } from 'bullmq'
import type { Redis } from 'ioredis'
import { QUEUE_NAMES, type QueueKey } from './names'
import {
  notificationSourceKey,
  parseJobPayload,
  type JobName,
  type JobPayload,
} from './payloads'

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  // Failed jobs stay for inspection.
  removeOnFail: false,
}

export type Queues = Record<QueueKey, Queue>

/** `prefix` isolates key spaces, e.g. so tests never feed a running dev worker. */
export function createQueues(connection: Redis, options: { prefix?: string } = {}): Queues {
  const make = (name: string) =>
    new Queue(name, { connection, defaultJobOptions, prefix: options.prefix })
  return {
    githubWebhooks: make(QUEUE_NAMES.githubWebhooks),
    media: make(QUEUE_NAMES.media),
    maintenance: make(QUEUE_NAMES.maintenance),
    notifications: make(QUEUE_NAMES.notifications),
  }
}

export async function closeQueues(queues: Queues) {
  await Promise.all(Object.values(queues).map((q) => q.close()))
}

/** Type-checked enqueue: the payload is validated before it reaches Redis. */
export function enqueue<Q extends QueueKey, N extends JobName<Q>>(
  queues: Queues,
  queue: Q,
  name: N,
  payload: JobPayload<Q, N>,
  options?: JobsOptions,
) {
  const data = parseJobPayload(queue, name, payload)
  return queues[queue].add(name, data, options)
}

/**
 * Enqueues a `notify` job under a job id derived from its source, so an event that is
 * enqueued twice (a retried request or delivery) runs once.
 */
export function enqueueNotification(
  queues: Queues,
  payload: JobPayload<'notifications', 'notify'>,
) {
  return enqueue(queues, 'notifications', 'notify', payload, {
    jobId: notificationSourceKey(payload),
  })
}
