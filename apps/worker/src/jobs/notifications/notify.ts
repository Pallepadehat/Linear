import { createNotifications } from '@linear/core'
import { notificationSourceKey, type NotifyPayload } from '@linear/queue'
import type { JobDeps } from '../../deps'

/**
 * Creates the event's notifications, then tells each recipient's sockets. Idempotent:
 * a rerun finds the `(userId, sourceKey)` rows already there, inserts and publishes nothing.
 */
export async function processNotify(
  { db, logger, publishToUser }: JobDeps,
  payload: NotifyPayload,
) {
  const created = await createNotifications(db, {
    ...payload,
    sourceKey: notificationSourceKey(payload),
  })
  logger.info(
    { event: payload.event, issueId: payload.issueId, count: created.length },
    'notify: done',
  )
  // After the insert; a lost event heals on the client's next refetch.
  for (const { id, userId } of created) {
    await publishToUser(userId, {
      type: 'notification.created',
      workspaceId: payload.workspaceId,
      notificationId: id,
    }).catch((err: unknown) => logger.error({ err, notificationId: id }, 'notify: publish failed'))
  }
  return created
}
