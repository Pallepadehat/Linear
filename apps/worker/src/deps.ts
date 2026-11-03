import type { Db } from '@linear/db'
import type { RealtimePublisher } from '@linear/queue'
import type { Storage } from '@linear/storage'
import type { Logger } from 'pino'

/** What job handlers receive; tests pass their own implementations. */
export type JobDeps = {
  db: Db
  storage: Storage
  logger: Logger
  /** Realtime events for changes the worker makes (docs/domain.md → Realtime events). */
  publish: RealtimePublisher
}
