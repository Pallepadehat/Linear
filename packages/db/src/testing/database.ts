import postgres from 'postgres'
import { getTableName, isTable, sql, type Table } from 'drizzle-orm'
import type { DbOrTx } from '../client'
import { migrateDatabase } from '../migrator'
import * as schema from '../schema'

/** TEST_DATABASE_URL, or DATABASE_URL pointed at the `linear_test` database. */
export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for tests')
  const url = new URL(env.DATABASE_URL)
  url.pathname = '/linear_test'
  return url.toString()
}

/** Creates the test database if needed and applies migrations. Run once per test run. */
export async function prepareTestDatabase(url: string) {
  const target = new URL(url)
  const name = target.pathname.slice(1)
  const admin = new URL(url)
  admin.pathname = '/postgres'
  const client = postgres(admin.toString(), { max: 1, onnotice: () => {} })
  try {
    const [exists] = await client`select 1 from pg_database where datname = ${name}`
    if (!exists) await client.unsafe(`create database "${name.replace(/"/g, '""')}"`)
  } finally {
    await client.end()
  }
  await migrateDatabase(url)
}

const tableNames = (Object.values(schema) as unknown[])
  .filter((value): value is Table => isTable(value))
  .map((table) => getTableName(table))

/** Empties every application table. Call in `beforeEach` of DB-backed test files. */
export async function truncateAll(db: DbOrTx) {
  await db.execute(
    sql.raw(
      `truncate table ${tableNames.map((t) => `"${t}"`).join(', ')} restart identity cascade`,
    ),
  )
}
