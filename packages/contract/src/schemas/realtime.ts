import { z } from 'zod'
import { workspaceScopedSchema } from './common'

/** Mirrors `issueFieldSchema` in packages/queue (the API checks they stay in sync). */
export const realtimeIssueFieldSchema = z.enum([
  'title',
  'description',
  'status',
  'priority',
  'assignee',
  'project',
  'labels',
  'pullRequests',
])

const base = {
  issueId: z.uuid(),
  /** The user who made the change; `null` for automation (GitHub). */
  actorId: z.uuid().nullable(),
}

/** What a client receives; small and ID-based (docs/domain.md → Realtime events). */
export const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('issue.created'), ...base }),
  z.object({
    type: z.literal('issue.updated'),
    ...base,
    fields: z.array(realtimeIssueFieldSchema),
  }),
  z.object({ type: z.literal('issue.deleted'), ...base }),
  z.object({ type: z.literal('comment.created'), ...base, commentId: z.uuid() }),
  z.object({ type: z.literal('comment.updated'), ...base, commentId: z.uuid() }),
  z.object({ type: z.literal('comment.deleted'), ...base, commentId: z.uuid() }),
  // Any change to a project (create, update, delete); clients refetch their project queries.
  z.object({
    type: z.literal('project.updated'),
    projectId: z.uuid(),
    actorId: base.actorId,
  }),
])

/** Sent with every request (header) and with the subscription, so a tab skips its own echoes. */
export const realtimeClientIdSchema = z.string().min(1).max(64)
export const REALTIME_CLIENT_ID_HEADER = 'x-client-id'

export const subscribeRealtimeInputSchema = workspaceScopedSchema.extend({
  clientId: realtimeClientIdSchema.optional(),
})

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>
export type RealtimeIssueField = z.infer<typeof realtimeIssueFieldSchema>
