// Entry point for other workspaces' tests (apps/api acceptance tests run the real
// GitHub worker against the webhook route). Never imported at runtime.
import type { Db } from '@linear/db'
import type { RealtimePublisher } from '@linear/queue'
import { createMemoryStorage } from '@linear/storage/testing'
import { pino } from 'pino'
import type { JobDeps } from './deps'

export { processNotify } from './jobs/notifications/notify'
export { createGithubWorker } from './workers/github.worker'

/**
 * Job deps for tests: the given database, in-memory storage and a silent logger.
 * Realtime events and `notify` jobs are dropped unless overridden.
 */
export function createTestJobDeps(
  db: Db,
  publish: RealtimePublisher = async () => {},
  overrides: Partial<JobDeps> = {},
): JobDeps {
  return {
    db,
    storage: createMemoryStorage().storage,
    logger: pino({ level: 'silent' }),
    publish,
    publishToUser: async () => {},
    notify: async () => {},
    ...overrides,
  }
}
