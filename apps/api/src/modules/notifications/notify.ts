import { enqueueNotification, type NotifyPayload } from '@linear/queue'
import type { InitialContext } from '../../orpc/context'

type NotifyContext = Pick<InitialContext, 'queues' | 'logger'> & {
  user: { id: string }
  workspace: { id: string }
}

type NotifyEvent = Omit<NotifyPayload, 'workspaceId' | 'actorId'>

/**
 * Enqueues `notify` jobs for changes the requesting user just committed
 * (docs/domain.md → Notifications). Best effort: a failed enqueue is logged and never
 * fails the change. Job ids come from the source, so a retried request adds nothing.
 */
export async function notify(context: NotifyContext, events: NotifyEvent[]) {
  for (const event of events) {
    await enqueueNotification(context.queues, {
      ...event,
      workspaceId: context.workspace.id,
      actorId: context.user.id,
    }).catch((err: unknown) =>
      context.logger.error({ err, event: event.event }, 'notify: enqueue failed'),
    )
  }
}

/** The notify events an issue update causes: a new assignee, a status change. */
export function issueUpdateEvents(
  issueId: string,
  activity: { id: string; kind: string }[],
  assigneeId: string | null,
): NotifyEvent[] {
  return activity.flatMap((entry): NotifyEvent[] => {
    if (entry.kind === 'assignee' && assigneeId) {
      return [{ issueId, event: 'assigned', activityId: entry.id }]
    }
    if (entry.kind === 'status') return [{ issueId, event: 'status_changed', activityId: entry.id }]
    return []
  })
}
