import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Schema = typeof schema
export type Db = PostgresJsDatabase<Schema>
/** A transaction handle; accepted anywhere a `Db` is, so services compose inside transactions. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx

export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10, onnotice: () => {} })
  const db: Db = drizzle(client, { schema, casing: 'snake_case' })
  return { db, close: () => client.end() }
}
