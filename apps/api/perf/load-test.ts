// Load test: ramps concurrent virtual users (VUs) up in stages against a real api process and
// prints a performance table (latency percentiles, throughput, errors, CPU and RAM).
//
//   bun run --filter @linear/api perf                 # stages 1,5,10,20 × 20 s
//   PERF_STAGES=1,5,10,20,50 PERF_STAGE_SECONDS=30 bun run --filter @linear/api perf
//
// It builds its own world: a fresh `linear_perf` database (seed + PERF_ISSUES bulk issues), an
// api on PERF_API_PORT in production mode, Redis DB 2. Postgres/Redis come from the root .env
// (or DATABASE_URL / REDIS_URL). PERF_DOCKER_CONTAINER (a container name or id) adds the
// database container's CPU/RAM to the table. Exits 1 when the last stage misses the SLO.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ContractClient } from '@linear/contract'
import { loadRootEnvFile } from '@linear/env'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createDb } from '@linear/db'
import { sql } from 'drizzle-orm'

loadRootEnvFile()

const env = process.env
const STAGES = (env.PERF_STAGES ?? '1,5,10,20').split(',').map(Number)
const STAGE_SECONDS = Number(env.PERF_STAGE_SECONDS ?? 20)
const ISSUES = Number(env.PERF_ISSUES ?? 1200)
const PORT = Number(env.PERF_API_PORT ?? 3200)
const SLO = { p95Ms: Number(env.PERF_SLO_P95_MS ?? 500), errorRate: 0.01 }
const DOCKER_CONTAINER = env.PERF_DOCKER_CONTAINER

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const apiDir = fileURLToPath(new URL('../', import.meta.url))
const resultsDir = fileURLToPath(new URL('./results/', import.meta.url))
const baseUrl = `http://localhost:${PORT}`
const appUrl = 'http://localhost:5173'

const withPath = (url: string, path: string) =>
  Object.assign(new URL(url), { pathname: path }).toString()
const databaseUrl = withPath(
  env.DATABASE_URL ?? 'postgres://linear:linear@localhost:5432/linear',
  '/linear_perf',
)
const redisUrl = withPath(env.REDIS_URL ?? 'redis://localhost:6379', '/2')

const stackEnv: NodeJS.ProcessEnv = {
  ...env,
  NODE_ENV: 'production',
  LOG_LEVEL: 'warn',
  PORT: String(PORT),
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
  BETTER_AUTH_SECRET: 'perf-auth-secret-at-least-32-characters',
  BETTER_AUTH_URL: appUrl,
  APP_URL: appUrl,
  S3_ENDPOINT: env.S3_ENDPOINT || 'http://localhost:9000',
  S3_ACCESS_KEY: env.S3_ACCESS_KEY || 'linear',
  S3_SECRET_KEY: env.S3_SECRET_KEY || 'linear-storage-secret',
  GITHUB_APP_ID: '',
  GITHUB_APP_PRIVATE_KEY: '',
  GITHUB_APP_SLUG: '',
  GITHUB_APP_CLIENT_ID: '',
  GITHUB_APP_CLIENT_SECRET: '',
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: repoRoot, env: stackEnv, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
}

async function resetDatabase() {
  const admin = createDb(withPath(databaseUrl, '/postgres'), { max: 1 })
  try {
    await admin.db.execute(sql.raw('drop database if exists "linear_perf" with (force)'))
    await admin.db.execute(sql.raw('create database "linear_perf"'))
  } finally {
    await admin.close()
  }
  run('bun', ['run', 'db:migrate'])
  run('bun', ['run', 'db:seed'])
  run('bun', ['run', 'db:seed:issues', '--', String(ISSUES)])
}

async function waitFor(url: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`${url} did not become ready`)
}

async function signIn() {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: appUrl },
    body: JSON.stringify({ email: 'demo@tip.dev', password: 'password123' }),
  })
  if (!res.ok) throw new Error(`sign-in failed: ${res.status}`)
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

// ── Measuring ────────────────────────────────────────────────────────────────

type Sample = { stage: number; name: string; ms: number; ok: boolean }
type Resource = {
  stage: number
  apiCpu: number
  apiRssMb: number
  dbCpu?: number
  dbMemMb?: number
}

const samples: Sample[] = []
const resources: Resource[] = []

/** CPU % (of one core) and resident memory of a process, from `ps`. */
function processUsage(pid: number) {
  const out = spawnSync('ps', ['-o', '%cpu=,rss=', '-p', String(pid)], { encoding: 'utf8' }).stdout
  const [cpu, rss] = out.trim().split(/\s+/).map(Number)
  return { cpu: cpu ?? 0, rssMb: (rss ?? 0) / 1024 }
}

/** CPU % and memory of a Docker container (Postgres), when one was named. */
function containerUsage(): Promise<{ cpu: number; memMb: number } | undefined> {
  if (!DOCKER_CONTAINER) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const child = spawn('docker', [
      'stats',
      '--no-stream',
      '--format',
      '{{.CPUPerc}};{{.MemUsage}}',
      DOCKER_CONTAINER,
    ])
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()))
    child.on('close', () => {
      const [cpu, mem] = out.trim().split(';')
      if (!cpu || !mem) return resolve(undefined)
      const [, value, unit] = /([\d.]+)\s*([KMG]i?B)/.exec(mem) ?? []
      const factor = unit?.startsWith('G') ? 1024 : unit?.startsWith('K') ? 1 / 1024 : 1
      resolve({ cpu: Number.parseFloat(cpu), memMb: Number(value) * factor })
    })
    child.on('error', () => resolve(undefined))
  })
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!
}

// ── Virtual user ─────────────────────────────────────────────────────────────

/** One user's loop: open my issues, page the team list, search, open an issue, sometimes create one. */
async function virtualUser(
  client: ContractClient,
  teamId: string,
  stage: number,
  until: number,
  record: boolean,
) {
  const time = async (name: string, call: () => Promise<unknown>) => {
    const started = performance.now()
    let ok = true
    try {
      await call()
    } catch {
      ok = false
    }
    if (record) samples.push({ stage, name, ms: performance.now() - started, ok })
  }
  let iteration = 0
  while (Date.now() < until) {
    iteration++
    const number = 1 + Math.floor(Math.random() * ISSUES)
    await time('me.get', () => client.me.get())
    await time('issues.list', () => client.issues.list({ workspaceSlug: 'tip', teamId, limit: 50 }))
    await time('issues.list (search)', () =>
      client.issues.list({ workspaceSlug: 'tip', q: 'login', limit: 50 }),
    )
    await time('issues.getByIdentifier', () =>
      client.issues.getByIdentifier({ workspaceSlug: 'tip', identifier: `TIP-${number}` }),
    )
    if (iteration % 5 === 0) {
      await time('issues.create', () =>
        client.issues.create({
          workspaceSlug: 'tip',
          teamId,
          title: `Load test ${stage}/${iteration}`,
        }),
      )
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`[perf] preparing linear_perf with ${ISSUES} issues`)
await resetDatabase()

const api = spawn('bun', ['src/index.ts'], { cwd: apiDir, env: stackEnv, stdio: 'inherit' })
const stopApi = () => api.kill('SIGTERM')
process.once('SIGINT', () => {
  stopApi()
  process.exit(130)
})

let failed = false
try {
  await waitFor(`${baseUrl}/health`)
  const cookie = await signIn()
  const client: ContractClient = createORPCClient(
    new RPCLink({ url: `${baseUrl}/rpc`, headers: { cookie } }),
  )
  const team = (await client.teams.list({ workspaceSlug: 'tip' })).find((t) => t.key === 'TIP')!

  // Warm-up (JIT, connection pool, caches); not recorded.
  await virtualUser(client, team.id, 0, Date.now() + 3000, false)

  for (const vus of STAGES) {
    console.log(`[perf] stage: ${vus} concurrent users for ${STAGE_SECONDS}s`)
    const until = Date.now() + STAGE_SECONDS * 1000
    const sampler = setInterval(async () => {
      const apiUsage = processUsage(api.pid!)
      const db = await containerUsage()
      resources.push({
        stage: vus,
        apiCpu: apiUsage.cpu,
        apiRssMb: apiUsage.rssMb,
        dbCpu: db?.cpu,
        dbMemMb: db?.memMb,
      })
    }, 1000)
    await Promise.all(
      Array.from({ length: vus }, () => virtualUser(client, team.id, vus, until, true)),
    )
    clearInterval(sampler)
  }
} catch (error) {
  console.error('[perf]', error)
  failed = true
} finally {
  stopApi()
}

// ── Report ───────────────────────────────────────────────────────────────────

const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1)
const fmt = (n: number, digits = 0) => n.toFixed(digits)

type StageRow = {
  vus: number
  requests: number
  rps: number
  p50: number
  p95: number
  p99: number
  max: number
  errorRate: number
  apiCpuAvg: number
  apiCpuMax: number
  apiRssMax: number
  dbCpuAvg?: number
  dbMemMax?: number
}

const stageRows: StageRow[] = STAGES.map((vus) => {
  const stageSamples = samples.filter((s) => s.stage === vus)
  const ms = stageSamples.map((s) => s.ms).sort((a, b) => a - b)
  const usage = resources.filter((r) => r.stage === vus)
  const db = usage.filter((r) => r.dbCpu !== undefined)
  return {
    vus,
    requests: stageSamples.length,
    rps: stageSamples.length / STAGE_SECONDS,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
    p99: percentile(ms, 99),
    max: ms.at(-1) ?? 0,
    errorRate: stageSamples.filter((s) => !s.ok).length / Math.max(stageSamples.length, 1),
    apiCpuAvg: avg(usage.map((r) => r.apiCpu)),
    apiCpuMax: Math.max(0, ...usage.map((r) => r.apiCpu)),
    apiRssMax: Math.max(0, ...usage.map((r) => r.apiRssMb)),
    dbCpuAvg: db.length ? avg(db.map((r) => r.dbCpu!)) : undefined,
    dbMemMax: db.length ? Math.max(...db.map((r) => r.dbMemMb!)) : undefined,
  }
})

const peak = STAGES.at(-1)!
const endpointRows = [...new Set(samples.filter((s) => s.stage === peak).map((s) => s.name))].map(
  (name) => {
    const ofName = samples.filter((s) => s.stage === peak && s.name === name)
    const ms = ofName.map((s) => s.ms).sort((a, b) => a - b)
    return {
      name,
      requests: ofName.length,
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
      max: ms.at(-1) ?? 0,
      errors: ofName.filter((s) => !s.ok).length,
    }
  },
)

const hasDb = stageRows.some((r) => r.dbCpuAvg !== undefined)
const lines = [
  `### Load test: ${STAGES.join(' → ')} concurrent users, ${STAGE_SECONDS}s per stage, ${ISSUES} issues`,
  '',
  `| Users | Requests | Req/s | p50 ms | p95 ms | p99 ms | Max ms | Errors | API CPU avg/max | API RAM max${hasDb ? ' | DB CPU avg | DB RAM max' : ''} |`,
  `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:${hasDb ? ' | ---: | ---:' : ''} |`,
  ...stageRows.map(
    (r) =>
      `| ${r.vus} | ${r.requests} | ${fmt(r.rps, 1)} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.p99)} | ${fmt(r.max)} | ${fmt(r.errorRate * 100, 2)} % | ${fmt(r.apiCpuAvg)} % / ${fmt(r.apiCpuMax)} % | ${fmt(r.apiRssMax)} MB${hasDb ? ` | ${fmt(r.dbCpuAvg ?? 0)} % | ${fmt(r.dbMemMax ?? 0)} MB` : ''} |`,
  ),
  '',
  `#### Per endpoint at ${peak} users`,
  '',
  '| Endpoint | Requests | p50 ms | p95 ms | Max ms | Errors |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...endpointRows
    .sort((a, b) => b.p95 - a.p95)
    .map(
      (r) =>
        `| ${r.name} | ${r.requests} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.max)} | ${r.errors} |`,
    ),
  '',
  `SLO at ${peak} users: p95 < ${SLO.p95Ms} ms and errors < ${SLO.errorRate * 100} %. CPU is % of one core.`,
]

const last = stageRows.at(-1)
const sloMet = Boolean(
  last && last.requests > 0 && last.p95 < SLO.p95Ms && last.errorRate < SLO.errorRate,
)
lines.push(sloMet ? '**Result: SLO met.**' : '**Result: SLO missed.**')

const report = lines.join('\n')
console.log(`\n${report}\n`)
mkdirSync(resultsDir, { recursive: true })
writeFileSync(`${resultsDir}latest.md`, `${report}\n`)
writeFileSync(
  `${resultsDir}latest.json`,
  JSON.stringify({ stages: stageRows, endpoints: endpointRows, slo: SLO, sloMet }, null, 2),
)
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${report}\n`)

process.exit(failed || !sloMet ? 1 : 0)
