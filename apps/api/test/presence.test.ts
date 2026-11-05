import type { ContractClient, RealtimeEvent } from '@linear/contract'
import { addMember } from '@linear/db/testing'
import { createRedisConnection } from '@linear/queue'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/websocket'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { createPresenceStore, PRESENCE_TTL_MS } from '../src/modules/presence/presence.store'
import { setupTestApp, signUp } from './harness'

const APP_URL = 'http://localhost:5173'

const { app, db } = await setupTestApp()
await app.listen({ port: 0, host: '127.0.0.1' })
const wsUrl = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/rpc/ws`
const redis = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379')

const sockets: WebSocket[] = []
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
})
afterAll(() => {
  sockets.forEach((s) => s.terminate())
  redis.disconnect()
})

const eventually = (check: () => void | Promise<void>) =>
  vi.waitFor(check, { timeout: 3_000, interval: 20 })

/** A browser tab: one socket, subscribed to the workspace, collecting its events. */
async function openTab(cookie: string, workspaceSlug: string) {
  const socket = new WebSocket(wsUrl, { headers: { origin: APP_URL, cookie } })
  sockets.push(socket)
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  const client: ContractClient = createORPCClient(
    new RPCLink({ websocket: socket as unknown as globalThis.WebSocket }),
  )
  const events: RealtimeEvent[] = []
  const iterator = await client.realtime.subscribe({ workspaceSlug })
  void (async () => {
    for await (const event of iterator) events.push(event)
  })().catch(() => {})
  // Let the server subscribe to the Redis channel before anything is published.
  await new Promise((resolve) => setTimeout(resolve, 150))
  const closed = new Promise((resolve) => socket.once('close', resolve))
  return { client, events, close: () => (socket.close(), closed) }
}

async function workspaceWithIssue() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const issue = await owner.client.issues.create({
    workspaceSlug: 'tip',
    teamId: team.id,
    title: 'Fix login',
  })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  return { owner, member, workspace, issue }
}

describe('presence store', () => {
  const workspaceId = () => crypto.randomUUID()
  const issueId = crypto.randomUUID()

  it('expires an entry after its TTL without heartbeats', async () => {
    let now = 1_000_000
    const store = createPresenceStore(redis, () => now)
    const ws = workspaceId()
    const userId = crypto.randomUUID()

    expect(
      await store.heartbeat(ws, userId, 'tab-1', { state: 'active', viewingIssueId: issueId }),
    ).toBe(true)
    now += PRESENCE_TTL_MS - 1
    expect((await store.list(ws)).online.get(userId)).toEqual({
      state: 'active',
      viewingIssueId: issueId,
    })

    now += 1
    const { online, seen, expired } = await store.list(ws)
    expect(online.has(userId)).toBe(false)
    expect(expired).toEqual([userId])
    // Last seen survives for "last seen" text; the entry is pruned only once.
    expect(seen.get(userId)).toEqual(new Date(1_000_000))
    expect((await store.list(ws)).expired).toEqual([])
  })

  it('a disconnect clears that connection, and the user once their last tab closes', async () => {
    const store = createPresenceStore(redis)
    const ws = workspaceId()
    const userId = crypto.randomUUID()
    await store.heartbeat(ws, userId, 'tab-1', { state: 'active', viewingIssueId: issueId })
    await store.heartbeat(ws, userId, 'tab-2', { state: 'away', viewingIssueId: null })
    // The active tab leads the merged presence.
    expect((await store.list(ws)).online.get(userId)).toEqual({
      state: 'active',
      viewingIssueId: issueId,
    })

    expect(await store.disconnect(ws, userId, 'tab-1')).toBe(true)
    expect((await store.list(ws)).online.get(userId)).toEqual({
      state: 'away',
      viewingIssueId: null,
    })
    expect(await store.disconnect(ws, userId, 'tab-2')).toBe(true)
    expect((await store.list(ws)).online.has(userId)).toBe(false)
  })

  it('reports a change only when the merged presence changes', async () => {
    const store = createPresenceStore(redis)
    const ws = workspaceId()
    const userId = crypto.randomUUID()
    const beat = (state: 'active' | 'away') =>
      store.heartbeat(ws, userId, 'tab-1', { state, viewingIssueId: null })
    expect(await beat('active')).toBe(true)
    expect(await beat('active')).toBe(false)
    expect(await beat('away')).toBe(true)
  })
})

describe('presence over the realtime socket', () => {
  it('shows a teammate viewing an issue, and clears them when they disconnect', async () => {
    const { owner, member, issue } = await workspaceWithIssue()
    const ownerTab = await openTab(owner.cookie, 'tip')
    const memberTab = await openTab(member.cookie, 'tip')

    await memberTab.client.presence.heartbeat({
      workspaceSlug: 'tip',
      viewingIssueId: issue.id,
      state: 'active',
    })
    await eventually(() =>
      expect(ownerTab.events).toContainEqual({ type: 'presence.changed', userId: member.userId }),
    )
    expect(await owner.client.presence.list({ workspaceSlug: 'tip' })).toEqual([
      {
        userId: member.userId,
        state: 'active',
        viewingIssueId: issue.id,
        lastSeenAt: expect.any(Date),
      },
    ])

    ownerTab.events.length = 0
    await memberTab.close()
    await eventually(() =>
      expect(ownerTab.events).toContainEqual({ type: 'presence.changed', userId: member.userId }),
    )
    expect(await owner.client.presence.list({ workspaceSlug: 'tip' })).toEqual([
      expect.objectContaining({ userId: member.userId, state: 'offline', viewingIssueId: null }),
    ])
  })

  it("ignores heartbeats with another workspace's issue, and over HTTP", async () => {
    const { owner, member } = await workspaceWithIssue()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
    const otherTeam = await outsider.client.teams.create({
      workspaceSlug: 'other',
      name: 'Other',
      key: 'OTH',
    })
    const foreign = await outsider.client.issues.create({
      workspaceSlug: 'other',
      teamId: otherTeam.id,
      title: 'Secret',
    })

    const memberTab = await openTab(member.cookie, 'tip')
    await memberTab.client.presence.heartbeat({
      workspaceSlug: 'tip',
      viewingIssueId: foreign.id,
      state: 'active',
    })
    // Over HTTP there is no socket to tie the presence to.
    await member.client.presence.heartbeat({
      workspaceSlug: 'tip',
      viewingIssueId: null,
      state: 'active',
    })
    expect(await owner.client.presence.list({ workspaceSlug: 'tip' })).toEqual([])

    // A socket subscribed to another workspace can't beat into this one.
    const outsiderTab = await openTab(outsider.cookie, 'other')
    await expect(
      outsiderTab.client.presence.heartbeat({
        workspaceSlug: 'tip',
        viewingIssueId: null,
        state: 'active',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(outsider.client.presence.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('never lists non-members', async () => {
    const { owner, workspace } = await workspaceWithIssue()
    const outsider = await signUp(app, 'Outsider')
    // A leftover entry (e.g. a member who was removed) must not leak.
    await createPresenceStore(redis).heartbeat(workspace.id, outsider.userId, 'tab-x', {
      state: 'active',
      viewingIssueId: null,
    })
    const ownerTab = await openTab(owner.cookie, 'tip')
    await ownerTab.client.presence.heartbeat({
      workspaceSlug: 'tip',
      viewingIssueId: null,
      state: 'away',
    })

    expect(await owner.client.presence.list({ workspaceSlug: 'tip' })).toEqual([
      expect.objectContaining({ userId: owner.userId, state: 'away' }),
    ])
  })
})

describe('comment typing over the realtime socket', () => {
  it("tells teammates who's writing a comment on an issue", async () => {
    const { owner, member, issue } = await workspaceWithIssue()
    const ownerTab = await openTab(owner.cookie, 'tip')
    const memberTab = await openTab(member.cookie, 'tip')

    await memberTab.client.presence.typing({
      workspaceSlug: 'tip',
      issueId: issue.id,
      typing: true,
    })
    await eventually(() =>
      expect(ownerTab.events).toContainEqual({
        type: 'comment.typing',
        issueId: issue.id,
        userId: member.userId,
        typing: true,
      }),
    )

    await memberTab.client.presence.typing({
      workspaceSlug: 'tip',
      issueId: issue.id,
      typing: false,
    })
    await eventually(() =>
      expect(ownerTab.events).toContainEqual({
        type: 'comment.typing',
        issueId: issue.id,
        userId: member.userId,
        typing: false,
      }),
    )
  })

  it("ignores typing over HTTP and on another workspace's issue", async () => {
    const { owner, member, issue } = await workspaceWithIssue()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
    const otherTeam = await outsider.client.teams.create({
      workspaceSlug: 'other',
      name: 'Other',
      key: 'OTH',
    })
    const foreign = await outsider.client.issues.create({
      workspaceSlug: 'other',
      teamId: otherTeam.id,
      title: 'Secret',
    })
    const ownerTab = await openTab(owner.cookie, 'tip')
    const memberTab = await openTab(member.cookie, 'tip')

    // Over HTTP there is no socket subscribed to the workspace.
    await member.client.presence.typing({ workspaceSlug: 'tip', issueId: issue.id, typing: true })
    await memberTab.client.presence.typing({
      workspaceSlug: 'tip',
      issueId: foreign.id,
      typing: true,
    })
    // A later event proves the earlier ones would have arrived by now.
    await memberTab.client.presence.heartbeat({
      workspaceSlug: 'tip',
      viewingIssueId: null,
      state: 'active',
    })
    await eventually(() =>
      expect(ownerTab.events.some((e) => e.type === 'presence.changed')).toBe(true),
    )
    expect(ownerTab.events.filter((e) => e.type === 'comment.typing')).toEqual([])
  })
})
