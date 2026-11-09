import { listActiveProjectIds, snapshotProjectProgress } from '@linear/core'
import type { JobDeps } from '../../deps'

/**
 * Upserts today's progress snapshot for one project (docs/domain.md → Project progress).
 * Idempotent: a rerun on the same day rewrites the same row. A deleted project is a no-op.
 */
export async function projectProgressSnapshot(deps: JobDeps, projectId: string, now = new Date()) {
  const snapshot = await snapshotProjectProgress(deps.db, projectId, now)
  if (!snapshot) deps.logger.debug({ projectId }, 'project-progress-snapshot: project gone')
}

/**
 * Snapshots every planned or in-progress project once a day. Each project is its own
 * write, so one failure doesn't block the rest; the job then fails and is retried.
 */
export async function projectProgressDaily(deps: JobDeps, now = new Date()) {
  let failed = 0
  for (const projectId of await listActiveProjectIds(deps.db)) {
    try {
      await snapshotProjectProgress(deps.db, projectId, now)
    } catch (err) {
      failed++
      deps.logger.error({ projectId, err }, 'project-progress-daily: project failed')
    }
  }
  if (failed) throw new Error(`project-progress-daily: ${failed} project(s) failed`)
}
