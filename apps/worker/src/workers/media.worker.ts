import { QUEUE_NAMES, parseJobPayload } from '@linear/queue'
import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { JobDeps } from '../deps'
import { processImage } from '../jobs/media/process-image'

export function createMediaWorker(deps: JobDeps, connection: Redis) {
  return new Worker(
    QUEUE_NAMES.media,
    async (job) => {
      switch (job.name) {
        case 'process-image':
          return processImage(deps, parseJobPayload('media', 'process-image', job.data).uploadId)
        default:
          throw new Error(`unknown media job ${job.name}`)
      }
    },
    // sharp is CPU-bound; keep concurrency low.
    { connection, concurrency: 2 },
  )
}
