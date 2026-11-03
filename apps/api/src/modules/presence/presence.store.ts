import type { PresenceState } from '@linear/contract'
import type { Redis } from 'ioredis'
import { z } from 'zod'

/** A connection that misses this long without a heartbeat (sent every 20 s) is gone. */
export const PRESENCE_TTL_MS = 60_000

export type Presence = { state: PresenceState; viewingIssueId: string | null }

export type PresenceStore = ReturnType<typeof createPresenceStore>

const connectionSchema = z.object({
  state: z.enum(['active', 'away']),
  viewingIssueId: z.uuid().nullable(),
  at: z.number(),
})
type Connection = z.infer<typeof connectionSchema>

// Keys (docs/domain.md → Presence). Redis only, no table:
// - `presence:<ws>:<user>`  hash connectionId → { state, viewingIssueId, at }, TTL refreshed per beat
// - `presence:<ws>`         sorted set userId → expiry (ms), for listing and pruning
// - `presence:<ws>:seen`    hash userId → last heartbeat (ms), for "last seen"
const userKey = (workspaceId: string, userId: string) => `presence:${workspaceId}:${userId}`
const indexKey = (workspaceId: string) => `presence:${workspaceId}`
const seenKey = (workspaceId: string) => `presence:${workspaceId}:seen`

/**
 * Presence per workspace member, merged across their open tabs (connections):
 * `active` if any live tab is active, viewing whatever the most recent active tab
 * (else the most recent tab) reported. Expired entries are pruned when read.
 */
export function createPresenceStore(redis: Redis, now: () => number = Date.now) {
  async function readUser(workspaceId: string, userId: string, at: number) {
    const raw = await redis.hgetall(userKey(workspaceId, userId))
    return merge(raw, at)
  }

  return {
    /** Records a heartbeat; resolves to whether the user's merged presence changed. */
    async heartbeat(workspaceId: string, userId: string, connectionId: string, presence: Presence) {
      const at = now()
      const before = await readUser(workspaceId, userId, at)
      const entry: Connection = { ...presence, at }
      await redis
        .multi()
        .hset(userKey(workspaceId, userId), connectionId, JSON.stringify(entry))
        .pexpire(userKey(workspaceId, userId), PRESENCE_TTL_MS)
        .zadd(indexKey(workspaceId), at + PRESENCE_TTL_MS, userId)
        .hset(seenKey(workspaceId), userId, String(at))
        .exec()
      return !samePresence(before, await readUser(workspaceId, userId, at))
    },

    /** Drops one closed connection; resolves to whether the user's merged presence changed. */
    async disconnect(workspaceId: string, userId: string, connectionId: string) {
      const at = now()
      const before = await readUser(workspaceId, userId, at)
      await redis.hdel(userKey(workspaceId, userId), connectionId)
      const after = await readUser(workspaceId, userId, at)
      if (!after) {
        await redis
          .multi()
          .zrem(indexKey(workspaceId), userId)
          .del(userKey(workspaceId, userId))
          .exec()
      }
      return !samePresence(before, after)
    },

    /**
     * Everyone with a live connection, plus last-seen times. `expired` lists the users
     * pruned by this read, so the caller can announce that they went offline.
     */
    async list(workspaceId: string) {
      const at = now()
      const expired = await redis.zrangebyscore(indexKey(workspaceId), '-inf', at)
      if (expired.length) {
        await redis
          .multi()
          .zrem(indexKey(workspaceId), ...expired)
          .del(...expired.map((userId) => userKey(workspaceId, userId)))
          .exec()
      }
      const userIds = await redis.zrangebyscore(indexKey(workspaceId), `(${at}`, '+inf')
      const online = new Map<string, Presence>()
      for (const userId of userIds) {
        const presence = await readUser(workspaceId, userId, at)
        if (presence) online.set(userId, presence)
      }
      const seen = new Map(
        Object.entries(await redis.hgetall(seenKey(workspaceId))).map(([userId, ms]) => [
          userId,
          new Date(Number(ms)),
        ]),
      )
      return { online, seen, expired }
    },
  }
}

function merge(raw: Record<string, string>, at: number): Presence | null {
  const live = Object.values(raw)
    .map((value) => connectionSchema.safeParse(safeJson(value)))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .filter((c) => c.at + PRESENCE_TTL_MS > at)
    .sort((a, b) => b.at - a.at)
  if (!live.length) return null
  const lead = live.find((c) => c.state === 'active') ?? live[0]!
  return { state: lead.state, viewingIssueId: lead.viewingIssueId }
}

function samePresence(a: Presence | null, b: Presence | null) {
  return a?.state === b?.state && a?.viewingIssueId === b?.viewingIssueId
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
