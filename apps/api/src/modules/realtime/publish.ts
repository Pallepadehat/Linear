import { REALTIME_CLIENT_ID_HEADER, realtimeClientIdSchema } from '@linear/contract'
import type { IssueField, RealtimeEvent } from '@linear/queue'
import type { RealtimeHub } from './realtime.hub'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

type PublishContext = {
  realtime: RealtimeHub
  headers: Headers
  user: { id: string }
  workspace: { id: string }
}

/** Publishes a change made by the requesting user, tagged with their tab's client id. */
export function publishChange(
  context: PublishContext,
  event: DistributiveOmit<RealtimeEvent, 'actorId' | 'originId'>,
) {
  const clientId = realtimeClientIdSchema.safeParse(context.headers.get(REALTIME_CLIENT_ID_HEADER))
  return context.realtime.publish(context.workspace.id, {
    ...event,
    actorId: context.user.id,
    originId: clientId.success ? clientId.data : null,
  } as RealtimeEvent)
}

const ISSUE_INPUT_FIELDS = {
  title: 'title',
  description: 'description',
  statusId: 'status',
  priority: 'priority',
  assigneeId: 'assignee',
  projectId: 'project',
  estimate: 'estimate',
  labelIds: 'labels',
  dueDate: 'dueDate',
} as const satisfies Record<string, IssueField>

/**
 * The fields an `issues.update` input touches (omitted means unchanged).
 * Assigning someone may subscribe them, so it touches the subscribers too.
 */
export function changedIssueFields(
  input: Partial<Record<keyof typeof ISSUE_INPUT_FIELDS, unknown>>,
) {
  const fields: IssueField[] = (
    Object.keys(ISSUE_INPUT_FIELDS) as (keyof typeof ISSUE_INPUT_FIELDS)[]
  )
    .filter((key) => input[key] !== undefined)
    .map((key) => ISSUE_INPUT_FIELDS[key])
  if (input.assigneeId) fields.push('subscribers')
  return fields
}
