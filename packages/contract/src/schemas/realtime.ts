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
  'dueDate',
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
  /** A template was created, changed or deleted (docs/domain.md → Templates). */
  z.object({
    type: z.literal('template.updated'),
    templateId: z.uuid(),
    actorId: z.uuid().nullable(),
  }),
  z.object({ type: z.literal('presence.changed'), userId: z.uuid() }),
])

/** Sent with every request (header) and with the subscription, so a tab skips its own echoes. */
export const realtimeClientIdSchema = z.string().min(1).max(64)
export const REALTIME_CLIENT_ID_HEADER = 'x-client-id'

export const subscribeRealtimeInputSchema = workspaceScopedSchema.extend({
  clientId: realtimeClientIdSchema.optional(),
})

// Presence (docs/domain.md → Presence).
export const presenceStateSchema = z.enum(['active', 'away'])

/** Sent over the realtime WebSocket every 20 s, on route change and on visibility change. */
export const presenceHeartbeatInputSchema = workspaceScopedSchema.extend({
  viewingIssueId: z.uuid().nullable(),
  state: presenceStateSchema,
})

export const presenceEntrySchema = z.object({
  userId: z.uuid(),
  /** `offline` when the member has no live connection (then `viewingIssueId` is null). */
  state: z.enum(['active', 'away', 'offline']),
  viewingIssueId: z.uuid().nullable(),
  /** Last heartbeat; null if never seen. */
  lastSeenAt: z.date().nullable(),
})

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>
export type RealtimeIssueField = z.infer<typeof realtimeIssueFieldSchema>
export type PresenceState = z.infer<typeof presenceStateSchema>
export type PresenceEntry = z.infer<typeof presenceEntrySchema>
