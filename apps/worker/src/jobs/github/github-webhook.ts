import { markDeliveryFailed, processPullRequestDelivery } from '@linear/core'
import type { JobDeps } from '../../deps'

/**
 * Idempotent: a delivery that was already processed is skipped. On an unexpected error
 * the transaction rolls back, the delivery is marked `failed`, and the error is rethrown
 * so BullMQ retries; a later attempt that succeeds marks it `processed`.
 */
export async function processGithubWebhook({ db, logger }: JobDeps, deliveryId: string) {
  try {
    const outcome = await processPullRequestDelivery(db, deliveryId)
    logger.info({ deliveryId, outcome }, 'github-webhook: done')
  } catch (err) {
    await markDeliveryFailed(db, deliveryId, err instanceof Error ? err.message : 'Unknown error')
    throw err
  }
}
