// Entry point for other workspaces' tests (apps/api acceptance tests run the real
// GitHub worker against the webhook route). Never imported at runtime.
import type { Db } from '@linear/db'
import { createMemoryStorage } from '@linear/storage/testing'
import { pino } from 'pino'
import type { JobDeps } from './deps'

export { createGithubWorker } from './workers/github.worker'

/** Job deps for tests: the given database, in-memory storage and a silent logger. */
export function createTestJobDeps(db: Db): JobDeps {
  return { db, storage: createMemoryStorage().storage, logger: pino({ level: 'silent' }) }
}
