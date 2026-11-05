import type { Redis } from 'ioredis'
import { z } from 'zod'

/**
 * Domain events fanned out over Redis pub/sub (docs/domain.md → Realtime events).
 * Both the API and the worker publish; every API instance subscribes and forwards
 * them to its sockets. Like job payloads they carry IDs only — clients refetch.
 */
export const issueFieldSchema = z.enum([
  'title',
  'description',
  'status',
  'priority',
  'assignee',
  'project',
  'labels',
  'estimate',
  'dueDate',
  'pullRequests',
  'cycle',
  'milestone',
  // The issue's parent changed / one of its sub-issues was added, removed or changed status.
  'parent',
  'subIssues',
  'subscribers',
  'relations',
  'links',
])

const base = {
  issueId: z.uuid(),
  /** The user who made the change; `null` for automation (GitHub). */
  actorId: z.uuid().nullable(),
  /** The browser tab that made the change, so it can skip its own echo. Never sent to clients. */
  originId: z.string().max(64).nullable(),
}

export const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('issue.created'), ...base }),
  z.object({ type: z.literal('issue.updated'), ...base, fields: z.array(issueFieldSchema) }),
  z.object({ type: z.literal('issue.deleted'), ...base }),
  z.object({ type: z.literal('comment.created'), ...base, commentId: z.uuid() }),
  z.object({ type: z.literal('comment.updated'), ...base, commentId: z.uuid() }),
  z.object({ type: z.literal('comment.deleted'), ...base, commentId: z.uuid() }),
  // Any change to a project (create, update, delete).
  z.object({
    type: z.literal('project.updated'),
    projectId: z.uuid(),
    actorId: base.actorId,
    originId: base.originId,
  }),
  z.object({
    type: z.literal('template.updated'),
    templateId: z.uuid(),
    actorId: base.actorId,
    originId: base.originId,
  }),
  z.object({
    type: z.literal('view.updated'),
    viewId: z.uuid(),
    actorId: base.actorId,
    originId: base.originId,
  }),
  z.object({
    type: z.literal('view.deleted'),
    viewId: z.uuid(),
    actorId: base.actorId,
    originId: base.originId,
  }),
  // Ephemeral "is writing a comment" signal; mirrors the contract's `comment.typing`.
  z.object({
    type: z.literal('comment.typing'),
    issueId: z.uuid(),
    userId: z.uuid(),
    typing: z.boolean(),
    originId: z.string().max(64).nullable(),
  }),
  // A member's presence changed (online/away, viewed issue, went offline); clients refetch.
  z.object({
    type: z.literal('presence.changed'),
    userId: z.uuid(),
    originId: z.string().max(64).nullable(),
  }),
])

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>
export type IssueField = z.infer<typeof issueFieldSchema>

const CHANNEL_PREFIX = 'workspace:'

export const realtimeChannel = (workspaceId: string) => `${CHANNEL_PREFIX}${workspaceId}`

/** The workspace id of a `workspace:<id>` channel, or null for any other channel. */
export function workspaceIdOfChannel(channel: string) {
  return channel.startsWith(CHANNEL_PREFIX) ? channel.slice(CHANNEL_PREFIX.length) : null
}

export type RealtimePublisher = (workspaceId: string, event: RealtimeEvent) => Promise<void>

/** Publishes on a regular (non-subscriber) connection; callers publish after their commit. */
export function createRealtimePublisher(redis: Redis): RealtimePublisher {
  return async (workspaceId, event) => {
    await redis.publish(
      realtimeChannel(workspaceId),
      JSON.stringify(realtimeEventSchema.parse(event)),
    )
  }
}

/**
 * Events for one user only, on `user:<userId>` (docs/domain.md → Notifications). The API
 * forwards them to that user's sockets subscribed to the event's workspace.
 */
export const userEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('notification.created'),
    workspaceId: z.uuid(),
    notificationId: z.uuid(),
  }),
])

export type UserEvent = z.infer<typeof userEventSchema>

const USER_CHANNEL_PREFIX = 'user:'

export const userChannel = (userId: string) => `${USER_CHANNEL_PREFIX}${userId}`

/** The user id of a `user:<id>` channel, or null for any other channel. */
export function userIdOfChannel(channel: string) {
  return channel.startsWith(USER_CHANNEL_PREFIX) ? channel.slice(USER_CHANNEL_PREFIX.length) : null
}

export type UserEventPublisher = (userId: string, event: UserEvent) => Promise<void>

export function createUserEventPublisher(redis: Redis): UserEventPublisher {
  return async (userId, event) => {
    await redis.publish(userChannel(userId), JSON.stringify(userEventSchema.parse(event)))
  }
}
