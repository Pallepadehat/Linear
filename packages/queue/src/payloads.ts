import { z } from 'zod'
import type { QueueKey } from './names'

export const notificationEventSchema = z.enum([
  'assigned',
  'mentioned',
  'commented',
  'status_changed',
  'pr_linked',
  'issue_created_in_team',
])

/**
 * One event that may notify people (docs/domain.md → Notifications). The worker reloads
 * everything else. Exactly one source id names what caused it: the activity entry
 * (`assigned`, `status_changed`, `issue_created_in_team`, a description mention), the
 * comment (`commented`, a comment mention) or the GitHub delivery (`pr_linked`).
 */
export const notifyPayloadSchema = z
  .object({
    workspaceId: z.uuid(),
    issueId: z.uuid(),
    event: notificationEventSchema,
    /** The user who caused it; null for GitHub automation. */
    actorId: z.uuid().nullable(),
    activityId: z.uuid().optional(),
    commentId: z.uuid().optional(),
    deliveryId: z.uuid().optional(),
    /** `pr_linked`: the linked pull request. */
    pullRequestId: z.uuid().optional(),
    /** `mentioned`: who was mentioned (M10-03). */
    userIds: z.array(z.uuid()).max(100).optional(),
  })
  .refine((p) => [p.activityId, p.commentId, p.deliveryId].filter(Boolean).length === 1, {
    message: 'Exactly one of activityId, commentId or deliveryId is required',
  })

export type NotifyPayload = z.infer<typeof notifyPayloadSchema>

/**
 * Names the source of a notify event; the job id and each notification's unique
 * `(userId, sourceKey)` guard. No `:` (BullMQ job ids can't contain one).
 */
export function notificationSourceKey(payload: NotifyPayload) {
  const source = payload.activityId ?? payload.commentId ?? payload.deliveryId
  return `notify-${payload.event}-${payload.issueId}-${source}`
}

// Payloads carry IDs, never full records; handlers reload state from the DB.
export const jobSchemas = {
  media: {
    'process-image': z.object({ uploadId: z.uuid() }),
  },
  maintenance: {
    'delete-objects': z.object({ uploadId: z.uuid() }),
    'cleanup-pending': z.object({}),
    'cleanup-attachments': z.object({}),
    'cycles-maintain': z.object({}),
  },
  githubWebhooks: {
    pull_request: z.object({ deliveryId: z.uuid() }),
  },
  notifications: {
    notify: notifyPayloadSchema,
  },
} as const satisfies Record<QueueKey, Record<string, z.ZodType>>

export type JobSchemas = typeof jobSchemas
export type JobName<Q extends QueueKey> = keyof JobSchemas[Q] & string
export type JobPayload<
  Q extends QueueKey,
  N extends JobName<Q>,
> = JobSchemas[Q][N] extends z.ZodType ? z.infer<JobSchemas[Q][N]> : never

export function parseJobPayload<Q extends QueueKey, N extends JobName<Q>>(
  queue: Q,
  name: N,
  data: unknown,
): JobPayload<Q, N> {
  const schema = jobSchemas[queue][name] as z.ZodType
  return schema.parse(data) as JobPayload<Q, N>
}
