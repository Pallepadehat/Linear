import type { ContractClient, RealtimeEvent } from '@linear/contract'
import { addMember } from '@linear/db/testing'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/websocket'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { pullRequestEvent, setupGithubAcceptance } from './acceptance/github'
import { rpcClient, signUp } from './harness'

const APP_URL = 'http://localhost:5173'

// The GitHub harness includes the regular test app plus the real worker, so automation
// events travel worker → Redis → API → socket like in production.
const { app, db, arrange, deliver } = await setupGithubAcceptance()
await app.listen({ port: 0, host: '127.0.0.1' })
const wsUrl = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/rpc/ws`

const sockets: WebSocket[] = []
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close()
})
afterAll(() => sockets.forEach((s) => s.terminate()))

/** Opens a socket like the browser does (cookie + Origin); resolves once upgraded. */
function openSocket(headers: Record<string, string>) {
  const socket = new WebSocket(wsUrl, { headers: { origin: APP_URL, ...headers } })
  sockets.push(socket)
  return new Promise<WebSocket>((resolve, reject) => {
    socket.once('open', () => resolve(socket))
    socket.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)))
    socket.once('error', reject)
  })
}

/**
 * Subscribes `cookie`'s user to `workspaceSlug` and collects every event. `ready`
 * resolves once the server is listening (its first heartbeat-free roundtrip).
 */
async function subscribe(cookie: string, workspaceSlug: string, clientId?: string) {
  const socket = await openSocket({ cookie })
  const client: ContractClient = createORPCClient(
    new RPCLink({ websocket: socket as unknown as globalThis.WebSocket }),
  )
  const events: RealtimeEvent[] = []
  const iterator = await client.realtime.subscribe({ workspaceSlug, clientId })
  // Ends with an abort error when the test closes the socket.
  const done = (async () => {
    for await (const event of iterator) events.push(event)
  })().catch(() => {})
  // Let the server finish subscribing to the Redis channel before anything is published.
  await new Promise((resolve) => setTimeout(resolve, 150))
  return { events, done }
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
  return { owner, member, workspace, team, issue, statuses: team.statuses }
}

const eventually = (check: () => void) => vi.waitFor(check, { timeout: 3_000, interval: 20 })

describe('realtime', () => {
  it('rejects a socket without a session, or from another origin', async () => {
    await expect(openSocket({})).rejects.toThrow('HTTP 401')
    const { cookie } = await signUp(app, 'Someone')
    await expect(openSocket({ cookie, origin: 'https://evil.example' })).rejects.toThrow('HTTP 403')
  })

  it("streams a teammate's issue and comment changes to members", async () => {
    const { owner, member, issue, statuses } = await workspaceWithIssue()
    const { events } = await subscribe(member.cookie, 'tip')
    const inProgress = statuses.find((s) => s.name === 'In Progress')!

    await owner.client.issues.update({
      workspaceSlug: 'tip',
      id: issue.id,
      statusId: inProgress.id,
      assigneeId: member.userId,
    })
    const comment = await owner.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: 'On it',
    })
    await owner.client.comments.react({ workspaceSlug: 'tip', commentId: comment.id, emoji: '🚀' })
    const reply = await owner.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      parentId: comment.id,
      body: 'Done',
    })

    await eventually(() =>
      expect(events).toEqual([
        {
          type: 'issue.updated',
          issueId: issue.id,
          fields: ['status', 'assignee', 'subscribers'],
          actorId: owner.userId,
        },
        {
          type: 'comment.created',
          issueId: issue.id,
          commentId: comment.id,
          actorId: owner.userId,
        },
        // A reaction is an update of its comment; a reply is a new comment (ids only).
        {
          type: 'comment.updated',
          issueId: issue.id,
          commentId: comment.id,
          actorId: owner.userId,
        },
        {
          type: 'comment.created',
          issueId: issue.id,
          commentId: reply.id,
          actorId: owner.userId,
        },
      ]),
    )
  })

  it('streams project changes as ID-only project.updated events', async () => {
    const { owner, member } = await workspaceWithIssue()
    const { events } = await subscribe(member.cookie, 'tip')
    const project = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'Launch' })
    await owner.client.projects.update({ workspaceSlug: 'tip', id: project.id, priority: 1 })
    await owner.client.projects.delete({ workspaceSlug: 'tip', id: project.id })

    const event = { type: 'project.updated', projectId: project.id, actorId: owner.userId }
    await eventually(() => expect(events).toEqual([event, event, event]))
  })

  it('tells both projects when an issue moves between them', async () => {
    const { owner, member, issue } = await workspaceWithIssue()
    const from = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'From' })
    const to = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'To' })
    await owner.client.issues.update({ workspaceSlug: 'tip', id: issue.id, projectId: from.id })
    const { events } = await subscribe(member.cookie, 'tip')

    await owner.client.issues.update({ workspaceSlug: 'tip', id: issue.id, projectId: to.id })

    await eventually(() =>
      expect(events).toEqual([
        { type: 'issue.updated', issueId: issue.id, fields: ['project'], actorId: owner.userId },
        { type: 'project.updated', projectId: from.id, actorId: owner.userId },
        { type: 'project.updated', projectId: to.id, actorId: owner.userId },
      ]),
    )
  })

  it('tells both the sub-issue and its parent when the parent changes', async () => {
    const { owner, member, team, issue } = await workspaceWithIssue()
    const parent = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Parent',
    })
    const { events } = await subscribe(member.cookie, 'tip')

    await owner.client.issues.update({ workspaceSlug: 'tip', id: issue.id, parentId: parent.id })

    await eventually(() =>
      expect(events).toEqual([
        { type: 'issue.updated', issueId: issue.id, fields: ['parent'], actorId: owner.userId },
        { type: 'issue.updated', issueId: parent.id, fields: ['subIssues'], actorId: owner.userId },
      ]),
    )
  })

  it('skips the echo of a change made by the subscribing tab itself', async () => {
    const { owner, issue } = await workspaceWithIssue()
    const { events } = await subscribe(owner.cookie, 'tip', 'tab-1')
    // The browser sends its tab id as a header on every request.
    const fromTab = (clientId: string) => rpcClient(app, owner.cookie, { 'x-client-id': clientId })
    await fromTab('tab-1').issues.update({
      workspaceSlug: 'tip',
      id: issue.id,
      title: 'From this tab',
    })
    await fromTab('tab-2').issues.update({
      workspaceSlug: 'tip',
      id: issue.id,
      title: 'From another tab',
    })

    await eventually(() =>
      expect(events).toEqual([
        expect.objectContaining({ type: 'issue.updated', fields: ['title'] }),
      ]),
    )
    expect(events).toHaveLength(1)
  })

  it('signals relation changes on both issues', async () => {
    const { owner, member, team, issue } = await workspaceWithIssue()
    const other = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Duplicate login bug',
    })
    const { events } = await subscribe(member.cookie, 'tip')

    const relation = await owner.client.issueRelations.create({
      workspaceSlug: 'tip',
      issueId: other.id,
      relatedIssueId: issue.id,
      type: 'duplicate',
    })
    await owner.client.issueRelations.delete({ workspaceSlug: 'tip', id: relation.id })

    const update = { type: 'issue.updated', actorId: owner.userId }
    await eventually(() =>
      expect(events).toEqual([
        { ...update, issueId: other.id, fields: ['relations', 'status'] },
        { ...update, issueId: issue.id, fields: ['relations'] },
        { ...update, issueId: other.id, fields: ['relations'] },
        { ...update, issueId: issue.id, fields: ['relations'] },
      ]),
    )
  })

  it('never sends events to users outside the workspace (PRD Test 9)', async () => {
    const { owner, issue } = await workspaceWithIssue()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })

    await expect(subscribe(outsider.cookie, 'tip')).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // Subscribed to their own workspace, they see its events and none of Tip's.
    const { events } = await subscribe(outsider.cookie, 'other')
    await owner.client.issues.update({ workspaceSlug: 'tip', id: issue.id, priority: 1 })
    await owner.client.issues.delete({ workspaceSlug: 'tip', id: issue.id })
    const team = await outsider.client.teams.create({
      workspaceSlug: 'other',
      name: 'Other',
      key: 'OTH',
    })
    const own = await outsider.client.issues.create({
      workspaceSlug: 'other',
      teamId: team.id,
      title: 'Mine',
    })

    await eventually(() =>
      expect(events).toEqual([
        { type: 'issue.created', issueId: own.id, actorId: outsider.userId },
      ]),
    )
  })

  it('announces template changes by id only', async () => {
    const { owner, member } = await workspaceWithIssue()
    const { events } = await subscribe(member.cookie, 'tip')

    const template = await owner.client.templates.create({ workspaceSlug: 'tip', name: 'Bug' })
    await owner.client.templates.delete({ workspaceSlug: 'tip', id: template.id })

    const event = { type: 'template.updated', templateId: template.id, actorId: owner.userId }
    await eventually(() => expect(events).toEqual([event, event]))
  })

  it('delivers automation from the worker: a merged PR moving an issue to Done', async () => {
    const { workspace, issue } = await arrange()
    const member = await signUp(app, 'Watcher')
    await addMember(db, workspace.id, member.userId)
    const { events } = await subscribe(member.cookie, workspace.slug)

    await deliver(pullRequestEvent('opened'))
    await deliver(pullRequestEvent('closed.merged'))

    const update = { type: 'issue.updated', issueId: issue.id, actorId: null }
    await eventually(() =>
      expect(events).toEqual([
        { ...update, fields: ['status', 'pullRequests'] },
        { ...update, fields: ['status', 'pullRequests'] },
      ]),
    )
  })
})
