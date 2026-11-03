// Starts the whole stack for the E2E run (Playwright's `webServer`, see playwright.config.ts):
// Postgres/Redis via Docker if they aren't reachable, a fresh seeded `linear_e2e` database with
// the demo GitHub repository connected, then the api, the worker and the Vite app on E2E ports.
// Run with Bun. Stopping this process stops everything it started.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { apiPort, apiUrl, appPort, appUrl, databaseUrl, redisUrl, webhookSecret } from './config'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const appDir = fileURLToPath(new URL('../', import.meta.url))

// Explicit values win over the root .env (loadRootEnvFile never overrides), so a developer's
// own settings (GitHub App, ports, database) can't leak into the run.
const stackEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'development',
  LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? 'warn',
  PORT: String(apiPort),
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
  BETTER_AUTH_SECRET: 'e2e-auth-secret-at-least-32-characters',
  BETTER_AUTH_URL: appUrl,
  APP_URL: appUrl,
  S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://localhost:9000',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'linear',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'linear-storage-secret',
  GITHUB_APP_ID: '',
  GITHUB_APP_PRIVATE_KEY: '',
  GITHUB_APP_SLUG: '',
  GITHUB_APP_CLIENT_ID: '',
  GITHUB_APP_CLIENT_SECRET: '',
  GITHUB_WEBHOOK_SECRET: webhookSecret,
  VITE_API_URL: '',
}

const children: ChildProcess[] = []
let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 3000).unref()
}
process.once('SIGTERM', () => stop())
process.once('SIGINT', () => stop())

function run(command: string, args: string[], cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, env: stackEnv, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
}

function start(name: string, command: string, args: string[], cwd: string) {
  const child = spawn(command, args, { cwd, env: stackEnv, stdio: 'inherit' })
  child.once('exit', (code) => {
    if (stopping) return
    console.error(`[e2e] ${name} exited with code ${code}`)
    stop(1)
  })
  children.push(child)
}

/** False only when nothing listens; wrong credentials etc. still throw. */
async function canConnect(url: string) {
  const sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} })
  try {
    await sql`select 1`
    return true
  } catch (error) {
    if ((error as { code?: string }).code === 'ECONNREFUSED') return false
    throw error
  } finally {
    await sql.end({ timeout: 1 })
  }
}

async function resetDatabase() {
  const admin = new URL(databaseUrl)
  const name = admin.pathname.slice(1)
  if (!/^[a-z0-9_]+$/.test(name) || !name.includes('e2e')) {
    throw new Error(`refusing to reset "${name}": the E2E database name must contain "e2e"`)
  }
  admin.pathname = '/postgres'
  if (!(await canConnect(admin.toString()))) {
    if (process.env.CI) throw new Error('Postgres is not reachable')
    console.log('[e2e] Postgres not reachable; starting Docker services')
    run('docker', ['compose', 'up', '-d', '--wait', 'postgres', 'redis'])
  }
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
  try {
    await sql.unsafe(`drop database if exists "${name}" with (force)`)
    await sql.unsafe(`create database "${name}"`)
  } finally {
    await sql.end()
  }
}

async function waitFor(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${url} did not become ready`)
}

try {
  await resetDatabase()
  run('bun', ['run', 'db:migrate'])
  run('bun', ['run', 'db:seed'])
  run('bun', ['run', 'demo:github', 'connect'])

  start('api', 'bun', ['src/index.ts'], `${repoRoot}apps/api`)
  start('worker', 'bun', ['src/index.ts'], `${repoRoot}apps/worker`)
  await waitFor(`${apiUrl}/health`)
  start(
    'app',
    'bun',
    ['x', 'vite', '--configLoader', 'runner', '--port', String(appPort), '--strictPort'],
    appDir,
  )
  console.log(`[e2e] stack starting: app ${appUrl}, api ${apiUrl}`)
} catch (error) {
  console.error('[e2e]', error)
  stop(1)
}
