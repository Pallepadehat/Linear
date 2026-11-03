import type { Db } from '@linear/db'
import type { NotifyPayload, RealtimePublisher, UserEventPublisher } from '@linear/queue'
import type { Storage } from '@linear/storage'
import type { Logger } from 'pino'

/** What job handlers receive; tests pass their own implementations. */
export type JobDeps = {
  db: Db
  storage: Storage
  logger: Logger
  /** Realtime events for changes the worker makes (docs/domain.md → Realtime events). */
  publish: RealtimePublisher
  /** Events for one user's sockets (docs/domain.md → Notifications). */
  publishToUser: UserEventPublisher
  /** Enqueues a `notify` job (its job id comes from the source, so retries don't duplicate). */
  notify: (payload: NotifyPayload) => Promise<unknown>
}
