import type { Db } from '@linear/db'
import type { Queues } from '@linear/queue'
import type { Storage } from '@linear/storage'
import { sql } from 'drizzle-orm'
import Fastify from 'fastify'
import type { Redis } from 'ioredis'
import { createAuth } from './auth/auth'
import type { ApiEnv } from './env'
import { registerGithubWebhook } from './modules/github/github-webhook'
import { registerAuth } from './plugins/auth'
import { registerCors } from './plugins/cors'
import { registerORPC } from './plugins/orpc'

export type AppDeps = {
  env: Pick<
    ApiEnv,
    'LOG_LEVEL' | 'APP_URL' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'GITHUB_WEBHOOK_SECRET'
  >
  db: Db
  redis: Redis
  queues: Queues
  storage: Storage
}

/**
 * Builds the Fastify instance without listening or opening connections, so tests
 * can build it with their own dependencies and use `app.inject()`.
 */
export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: {
      level: deps.env.LOG_LEVEL,
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["x-hub-signature-256"]',
        'res.headers["set-cookie"]',
      ],
    },
    trustProxy: true,
  })

  const auth = createAuth({
    db: deps.db,
    secret: deps.env.BETTER_AUTH_SECRET,
    baseURL: deps.env.BETTER_AUTH_URL,
    trustedOrigins: [deps.env.APP_URL],
  })

  await registerGithubWebhook(app, deps)
  await registerCors(app, deps.env.APP_URL)
  await registerAuth(app, auth)
  await registerORPC(app, { db: deps.db, auth, queues: deps.queues, storage: deps.storage })

  app.get('/health', async (_request, reply) => {
    const [database, redis] = await Promise.allSettled([
      deps.db.execute(sql`select 1`),
      deps.redis.ping(),
    ])
    const ok = database.status === 'fulfilled' && redis.status === 'fulfilled'
    return reply.status(ok ? 200 : 503).send({
      status: ok ? 'ok' : 'degraded',
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    })
  })

  return app
}
