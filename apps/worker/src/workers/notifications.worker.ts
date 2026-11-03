import { QUEUE_NAMES, parseJobPayload } from '@linear/queue'
import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { JobDeps } from '../deps'
import { processNotify } from '../jobs/notifications/notify'

export function createNotificationsWorker(
  deps: JobDeps,
  connection: Redis,
  options: { prefix?: string } = {},
) {
  return new Worker(
    QUEUE_NAMES.notifications,
    async (job) => {
      switch (job.name) {
        case 'notify':
          await processNotify(deps, parseJobPayload('notifications', 'notify', job.data))
          return
        default:
          throw new Error(`unknown notifications job ${job.name}`)
      }
    },
    { connection, concurrency: 5, prefix: options.prefix },
  )
}
