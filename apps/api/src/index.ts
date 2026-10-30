import { createGitHubAppClient } from '@linear/core'
import { createDb } from '@linear/db'
import { closeQueues, createQueues, createRedisConnection } from '@linear/queue'
import { createStorage } from '@linear/storage'
import { buildApp } from './app'
import { loadApiEnv } from './env'

const env = loadApiEnv()
const { db, close: closeDb } = createDb(env.DATABASE_URL)
const redis = createRedisConnection(env.REDIS_URL)
const queues = createQueues(redis)
const storage = createStorage({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  bucket: env.S3_BUCKET,
})

// The env schema guarantees these are all set or all unset.
const github =
  env.GITHUB_APP_ID &&
  env.GITHUB_APP_PRIVATE_KEY &&
  env.GITHUB_APP_SLUG &&
  env.GITHUB_APP_CLIENT_ID &&
  env.GITHUB_APP_CLIENT_SECRET
    ? createGitHubAppClient({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
        slug: env.GITHUB_APP_SLUG,
        clientId: env.GITHUB_APP_CLIENT_ID,
        clientSecret: env.GITHUB_APP_CLIENT_SECRET,
      })
    : null

const app = await buildApp({ env, db, redis, queues, storage, github })

async function shutdown(signal: string) {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await closeQueues(queues)
  redis.disconnect()
  await closeDb()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

await app.listen({ port: env.PORT, host: '0.0.0.0' })
