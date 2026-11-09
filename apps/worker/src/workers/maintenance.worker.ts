import { QUEUE_NAMES, parseJobPayload } from '@linear/queue'
import { Queue, Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { JobDeps } from '../deps'
import { cleanupAttachments } from '../jobs/maintenance/cleanup-attachments'
import { cleanupPending } from '../jobs/maintenance/cleanup-pending'
import { cyclesMaintain } from '../jobs/maintenance/cycles-maintain'
import { deleteObjects } from '../jobs/maintenance/delete-objects'
import {
  projectProgressDaily,
  projectProgressSnapshot,
} from '../jobs/projects/project-progress-snapshot'

export function createMaintenanceWorker(deps: JobDeps, connection: Redis) {
  return new Worker(
    QUEUE_NAMES.maintenance,
    async (job) => {
      switch (job.name) {
        case 'delete-objects':
          return deleteObjects(
            deps,
            parseJobPayload('maintenance', 'delete-objects', job.data).uploadId,
          )
        case 'cleanup-pending':
          parseJobPayload('maintenance', 'cleanup-pending', job.data)
          return cleanupPending(deps)
        case 'cleanup-attachments':
          parseJobPayload('maintenance', 'cleanup-attachments', job.data)
          return cleanupAttachments(deps)
        case 'cycles-maintain':
          parseJobPayload('maintenance', 'cycles-maintain', job.data)
          return cyclesMaintain(deps)
        case 'project-progress-snapshot':
          return projectProgressSnapshot(
            deps,
            parseJobPayload('maintenance', 'project-progress-snapshot', job.data).projectId,
          )
        case 'project-progress-daily':
          parseJobPayload('maintenance', 'project-progress-daily', job.data)
          return projectProgressDaily(deps)
        default:
          throw new Error(`unknown maintenance job ${job.name}`)
      }
    },
    { connection },
  )
}

/** Registers the hourly cleanups, cycle upkeep and daily progress snapshots; upserting keeps a single schedule across restarts. */
export async function scheduleMaintenance(connection: Redis) {
  const queue = new Queue(QUEUE_NAMES.maintenance, { connection })
  await queue.upsertJobScheduler(
    'cleanup-pending',
    { every: 60 * 60 * 1000 },
    { name: 'cleanup-pending', data: {} },
  )
  await queue.upsertJobScheduler(
    'cleanup-attachments',
    { every: 60 * 60 * 1000 },
    { name: 'cleanup-attachments', data: {} },
  )
  // Hourly, on the hour, so each run covers one team-hour (docs/domain.md → Cycles).
  await queue.upsertJobScheduler(
    'cycles-maintain',
    { pattern: '0 * * * *', tz: 'UTC' },
    { name: 'cycles-maintain', data: {} },
  )
  // Late in the UTC day, so each day's row holds that day's closing counts
  // (docs/domain.md → Project progress).
  await queue.upsertJobScheduler(
    'project-progress-daily',
    { pattern: '55 23 * * *', tz: 'UTC' },
    { name: 'project-progress-daily', data: {} },
  )
  await queue.close()
}
