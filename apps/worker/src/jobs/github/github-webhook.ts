import { markDeliveryFailed, processPullRequestDelivery } from '@linear/core'
import type { JobDeps } from '../../deps'

/**
 * Idempotent: a delivery that was already processed is skipped. On an unexpected error
 * the transaction rolls back, the delivery is marked `failed`, and the error is rethrown
 * so BullMQ retries; a later attempt that succeeds marks it `processed`.
 */
export async function processGithubWebhook(
  { db, logger, publish, notify }: JobDeps,
  deliveryId: string,
) {
  let result
  try {
    result = await processPullRequestDelivery(db, deliveryId)
    logger.info({ deliveryId, outcome: result.outcome }, 'github-webhook: done')
  } catch (err) {
    await markDeliveryFailed(db, deliveryId, err instanceof Error ? err.message : 'Unknown error')
    throw err
  }

  // After the commit, and outside the try: a lost event must not retry the delivery
  // (it would be skipped anyway). Open clients resync on reconnect.
  const { workspaceId, pullRequestId, changedIssues } = result
  if (!workspaceId) return
  for (const { issueId, statusChanged } of changedIssues) {
    await publish(workspaceId, {
      type: 'issue.updated',
      issueId,
      fields: statusChanged ? ['status', 'pullRequests'] : ['pullRequests'],
      actorId: null,
      originId: null,
    }).catch((err: unknown) => logger.error({ err, deliveryId }, 'github-webhook: publish failed'))
  }

  // A merge that finished a milestone's last issue wrote `milestone.completed` to its project.
  for (const projectId of new Set(changedIssues.flatMap((issue) => issue.feedProjectIds))) {
    await publish(workspaceId, {
      type: 'project.updated',
      projectId,
      actorId: null,
      originId: null,
    }).catch((err: unknown) => logger.error({ err, deliveryId }, 'github-webhook: publish failed'))
  }

  // Subscribers hear about new links and status moves (docs/domain.md → Notifications).
  // Job ids come from the delivery / activity entry, so a retried job enqueues nothing new.
  const base = { workspaceId, actorId: null }
  for (const { issueId, linked, statusActivityIds } of changedIssues) {
    const jobs = [
      ...(linked && pullRequestId
        ? [{ ...base, issueId, event: 'pr_linked' as const, deliveryId, pullRequestId }]
        : []),
      ...statusActivityIds.map((activityId) => ({
        ...base,
        issueId,
        event: 'status_changed' as const,
        activityId,
      })),
    ]
    for (const job of jobs) {
      await notify(job).catch((err: unknown) =>
        logger.error({ err, deliveryId }, 'github-webhook: notify failed'),
      )
    }
  }
}
