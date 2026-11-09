import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb, type Db } from './client'

export const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

export async function migrateDatabase(url: string) {
  const { db, close } = createDb(url, { max: 1 })
  try {
    await assertNoStaleMigrations(db)
    await migrate(db, { migrationsFolder })
  } finally {
    await close()
  }
}

/**
 * Drizzle only applies migrations newer than the last applied one, so a DB that ran a
 * migration which was later renumbered or regenerated (e.g. after merging parallel
 * branches) silently skips older ones and then fails on "already exists". Fail early
 * with a clear message instead.
 */
async function assertNoStaleMigrations(db: Db) {
  const [table] = await db.execute<{ exists: boolean }>(
    sql`select to_regclass('drizzle.__drizzle_migrations') is not null as exists`,
  )
  if (!table?.exists) return

  const applied = await db.execute<{ hash: string }>(
    sql`select hash from drizzle.__drizzle_migrations`,
  )
  const known = new Set(readMigrationFiles({ migrationsFolder }).map((m) => m.hash))
  const stale = applied.filter((row) => !known.has(row.hash))
  if (stale.length > 0) {
    throw new Error(
      `Database has ${stale.length} applied migration(s) that no longer exist in ${migrationsFolder}. ` +
        'A migration was likely renumbered or regenerated after it ran locally. ' +
        'Reset the local database (docker compose down -v && docker compose up -d) and run db:migrate again.',
    )
  }
}
