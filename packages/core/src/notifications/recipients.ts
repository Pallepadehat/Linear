import type { notificationType } from '@linear/db'

export type NotificationType = (typeof notificationType.enumValues)[number]

/**
 * What happened, with the people it targets directly. Events without a target
 * (comments, status changes, linked PRs) go to the issue's subscribers.
 */
export type NotificationEvent =
  | { type: 'assigned'; assigneeId: string }
  | { type: 'mentioned'; userIds: readonly string[] }
  | { type: 'issue_created_in_team'; teamMemberIds: readonly string[] }
  | { type: 'commented' | 'status_changed' | 'pr_linked' }

/** Who the event is aimed at, before the actor and non-members are dropped. */
export function targetsOf(event: NotificationEvent, subscribers: readonly string[]) {
  switch (event.type) {
    case 'assigned':
      return [event.assigneeId]
    case 'mentioned':
      return event.userIds
    case 'issue_created_in_team':
      return event.teamMemberIds
    default:
      return subscribers
  }
}

/**
 * Who gets a notification (docs/domain.md → Notifications): the event's targets, never
 * the actor, only current workspace members, each once, in first-seen order.
 */
export function recipientsFor(
  event: NotificationEvent,
  subscribers: readonly string[],
  actorId: string | null,
  members: ReadonlySet<string>,
): string[] {
  return [...new Set(targetsOf(event, subscribers))].filter(
    (userId) => userId !== actorId && members.has(userId),
  )
}

/** The one-line Inbox summary, e.g. "Ada assigned you" or "GitHub changed status to Done". */
export function notificationSummary(input: {
  type: NotificationType
  actorType: 'user' | 'github'
  /** Null when the user was deleted. */
  actorName: string | null
  toStatusName?: string | null
  pullRequestNumber?: number | null
}) {
  const actor = input.actorType === 'github' ? 'GitHub' : (input.actorName ?? 'Someone')
  switch (input.type) {
    case 'assigned':
      return `${actor} assigned you`
    case 'mentioned':
      return `${actor} mentioned you`
    case 'commented':
      return `${actor} commented`
    case 'status_changed':
      return input.toStatusName
        ? `${actor} changed status to ${input.toStatusName}`
        : `${actor} changed status`
    case 'pr_linked':
      return input.pullRequestNumber
        ? `${actor} linked PR #${input.pullRequestNumber}`
        : `${actor} linked a pull request`
    case 'issue_created_in_team':
      return `${actor} created the issue`
  }
}
