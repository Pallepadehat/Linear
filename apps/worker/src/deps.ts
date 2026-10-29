import type { Db } from '@linear/db'
import type { Storage } from '@linear/storage'
import type { Logger } from 'pino'

/** What job handlers receive; tests pass their own implementations. */
export type JobDeps = {
  db: Db
  storage: Storage
  logger: Logger
}
