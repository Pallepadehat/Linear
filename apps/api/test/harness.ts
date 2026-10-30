import type { ContractClient } from '@linear/contract'
import type { GitHubAppClient } from '@linear/core'
import { createDb } from '@linear/db'
import { loadRootEnvFile } from '@linear/env'
import { testDatabaseUrl, truncateAll } from '@linear/db/testing'
import { closeQueues, createQueues, createRedisConnection } from '@linear/queue'
import { createMemoryStorage } from '@linear/storage/testing'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach } from 'vitest'
import { buildApp } from '../src/app'

loadRootEnvFile()

const APP_URL = 'http://localhost:5173'
export const TEST_AUTH_SECRET = 'test-secret-test-secret-test-secret'

/**
 * Builds the real app against the test database and Redis (under a `test`
 * prefix, so a running dev worker never picks jobs up). Storage is faked.
 * Truncates all tables before each test in the calling file. GitHub is off unless a
 * (fake) client is passed.
 */
export async function setupTestApp(options: { github?: GitHubAppClient } = {}) {
  const { db, close } = createDb(testDatabaseUrl(), { max: 5 })
  const redis = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379')
  const queues = createQueues(redis, { prefix: 'test' })
  const fake = createMemoryStorage()
  const app = await buildApp({
    env: {
      LOG_LEVEL: 'silent',
      GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
      APP_URL,
      BETTER_AUTH_URL: APP_URL,
      BETTER_AUTH_SECRET: TEST_AUTH_SECRET,
    },
    db,
    redis,
    queues,
    storage: fake.storage,
    github: options.github,
  })

  beforeEach(async () => {
    await truncateAll(db)
    fake.objects.clear()
    await Promise.all(Object.values(queues).map((q) => q.obliterate({ force: true })))
  })

  afterAll(async () => {
    await app.close()
    await closeQueues(queues)
    redis.disconnect()
    await close()
  })

  return { app, db, queues, objects: fake.objects }
}

/** Signs up a fresh user through Better Auth and returns their session cookie. */
export async function signUp(app: FastifyInstance, name = 'Test User') {
  const email = `${name.toLowerCase().replace(/\W+/g, '-')}-${crypto.randomUUID()}@example.test`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: APP_URL },
    payload: { email, password: 'password123', name },
  })
  if (res.statusCode !== 200) throw new Error(`sign-up failed: ${res.statusCode} ${res.body}`)
  const cookie = [res.headers['set-cookie']]
    .flat()
    .filter((c): c is string => Boolean(c))
    .map((c) => c.split(';')[0])
    .join('; ')
  const body = res.json() as { user: { id: string } }
  return { cookie, email, userId: body.user.id, client: rpcClient(app, cookie) }
}

/** A typed oRPC client that talks to the app through `inject()` (no network). */
export function rpcClient(app: FastifyInstance, cookie?: string): ContractClient {
  const link = new RPCLink({
    url: 'http://localhost/rpc',
    headers: cookie ? { cookie } : {},
    fetch: async (request) => {
      const req = request as Request
      const res = await app.inject({
        method: req.method as 'GET' | 'POST',
        url: new URL(req.url).pathname + new URL(req.url).search,
        headers: Object.fromEntries(req.headers),
        payload: req.method === 'GET' ? undefined : Buffer.from(await req.arrayBuffer()),
      })
      return new Response(res.rawPayload, {
        status: res.statusCode,
        headers: Object.entries(res.headers).flatMap(([k, v]) =>
          v === undefined
            ? []
            : [[k, Array.isArray(v) ? v.join(', ') : String(v)] as [string, string]],
        ),
      })
    },
  })
  return createORPCClient(link)
}
