import { enqueueProjectProgressSnapshots } from '@linear/queue'
import type { InitialContext } from '../../orpc/context'

/**
 * Queues a debounced progress snapshot for each project whose issue counts may have
 * changed (docs/domain.md → Project progress). Best effort: the change is already
 * committed, the read path shows today's live counts and the daily job catches up.
 */
export async function snapshotProjectsProgress(
  context: Pick<InitialContext, 'queues' | 'logger'>,
  projectIds: Iterable<string | null | undefined>,
) {
  await enqueueProjectProgressSnapshots(context.queues, projectIds).catch((err: unknown) =>
    context.logger.error({ err }, 'project-progress-snapshot: enqueue failed'),
  )
}

/** Only status and project changes move the snapshot counts (scope / started / completed). */
export function changesProgress(fields: { statusId?: unknown; projectId?: unknown }) {
  return fields.statusId !== undefined || fields.projectId !== undefined
}
