import { QUEUE_NAMES, parseJobPayload } from '@linear/queue'
import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { JobDeps } from '../deps'
import { processGithubWebhook } from '../jobs/github/github-webhook'

/** `prefix` must match the queues' prefix (tests use `test`, see apps/api/test/harness.ts). */
export function createGithubWorker(
  deps: JobDeps,
  connection: Redis,
  options: { prefix?: string } = {},
) {
  return new Worker(
    QUEUE_NAMES.githubWebhooks,
    async (job) => {
      switch (job.name) {
        case 'pull_request':
          return processGithubWebhook(
            deps,
            parseJobPayload('githubWebhooks', 'pull_request', job.data).deliveryId,
          )
        default:
          throw new Error(`unknown github job ${job.name}`)
      }
    },
    // Row locks keep concurrent deliveries for one PR correct; this just bounds DB load.
    { connection, concurrency: 5, prefix: options.prefix },
  )
}
