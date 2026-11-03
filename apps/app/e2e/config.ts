// Settings shared by the Playwright config, the stack launcher and the specs. Everything is
// overridable so the E2E stack can run next to a dev stack (or another E2E run) on one machine.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Same root .env the apps read (packages/env); variables already set win.
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url))
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const env = process.env

const withPath = (url: string, path: string) => {
  const next = new URL(url)
  next.pathname = path
  return next.toString()
}

export const apiPort = Number(env.E2E_API_PORT ?? 3100)
export const appPort = Number(env.E2E_APP_PORT ?? 5180)
export const apiUrl = `http://localhost:${apiPort}`
export const appUrl = `http://localhost:${appPort}`

/** A throwaway database, dropped and re-seeded on every run. */
export const databaseUrl =
  env.E2E_DATABASE_URL ??
  withPath(env.DATABASE_URL ?? 'postgres://linear:linear@localhost:5432/linear', '/linear_e2e')

/** Redis logical DB 1 keeps E2E queues away from a dev worker on DB 0. */
export const redisUrl =
  env.E2E_REDIS_URL ?? withPath(env.REDIS_URL ?? 'redis://localhost:6379', '/1')

/** Test-only secret; the api verifies webhooks with it and the specs sign with it. */
export const webhookSecret = 'e2e-webhook-secret'

/** The repository `demo:github connect` attaches to the seeded workspace (packages/db/src/demo-github.ts). */
export const demoRepo = {
  id: 9_000_000_001,
  fullName: 'tip-demo/linear-demo',
  installationId: 9_000_000_001,
}

export const demoUser = { email: 'demo@tip.dev', password: 'password123', workspace: 'tip' }
