import { createDb } from '@linear/db'
import { loadWorkerEnv } from '@linear/env'
import {
  createQueues,
  createRealtimePublisher,
  createRedisConnection,
  createUserEventPublisher,
  closeQueues,
  enqueueNotification,
} from '@linear/queue'
import { createStorage } from '@linear/storage'
import type { Worker } from 'bullmq'
import { pino } from 'pino'
import { createGithubWorker } from './workers/github.worker'
import { createMaintenanceWorker, scheduleMaintenance } from './workers/maintenance.worker'
import { createMediaWorker } from './workers/media.worker'
import { createNotificationsWorker } from './workers/notifications.worker'

const env = loadWorkerEnv()
const logger = pino({ level: env.LOG_LEVEL })
const { db, close: closeDb } = createDb(env.DATABASE_URL)
const connection = createRedisConnection(env.REDIS_URL)
const storage = createStorage({
  endpoint: env.S3_ENDPOINT,
  publicEndpoint: env.S3_PUBLIC_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  bucket: env.S3_BUCKET,
})
const queues = createQueues(connection)
const deps = {
  db,
  storage,
  logger,
  publish: createRealtimePublisher(connection),
  publishToUser: createUserEventPublisher(connection),
  notify: (payload: Parameters<typeof enqueueNotification>[1]) =>
    enqueueNotification(queues, payload),
}

const workers: Worker[] = [
  createMediaWorker(deps, connection),
  createMaintenanceWorker(deps, connection),
  createGithubWorker(deps, connection),
  createNotificationsWorker(deps, connection),
]
for (const worker of workers) {
  worker.on('failed', (job, err) =>
    logger.error(
      { queue: worker.name, jobId: job?.id, job: job?.name, attempt: job?.attemptsMade, err },
      'job failed',
    ),
  )
  worker.on('error', (err) => logger.error({ queue: worker.name, err }, 'worker error'))
}
await scheduleMaintenance(connection)
logger.info({ queues: workers.map((w) => w.name) }, 'worker started')

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutting down; waiting for active jobs')
  // close() lets in-flight jobs finish; unfinished ones are retried by the next worker.
  await Promise.all(workers.map((w) => w.close()))
  await closeQueues(queues)
  connection.disconnect()
  await closeDb()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
