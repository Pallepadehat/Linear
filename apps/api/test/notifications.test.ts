import { notifications } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { parseJobPayload } from '@linear/queue'
import { createTestJobDeps, processNotify } from '@linear/worker/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db, queues } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }
const deps = createTestJobDeps(db)

/** Runs the `notify` jobs the API enqueued, like the worker would. */
async function runNotifyJobs() {
  const jobs = await queues.notifications.getJobs(['waiting', 'delayed', 'prioritized'])
  for (const job of jobs.reverse()) {
    await processNotify(deps, parseJobPayload('notifications', 'notify', job.data))
    await job.remove()
  }
}

/** Owner creates TIP-1; Member is a workspace member subscribed to it. */
async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ ...scope, name: 'Tip', key: 'TIP' })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  const issue = await owner.client.issues.create({ ...scope, teamId: team.id, title: 'Fix login' })
  await owner.client.issues.subscribe({ ...scope, issueId: issue.id, userId: member.userId })
  await runNotifyJobs()
  return { owner, member, workspace, team, issue }
}

describe('notifications', () => {
  it('notifies subscribers of a comment, never the author, and lists it as a DTO', async () => {
    const { owner, member, issue } = await arrange()
    await owner.client.comments.create({ ...scope, issueId: issue.id, body: 'Looks good' })
    await runNotifyJobs()

    expect(await owner.client.notifications.list(scope)).toEqual({ items: [], nextCursor: null })
    const page = await member.client.notifications.list(scope)
    expect(page).toEqual({
      items: [
        {
          id: expect.any(String),
          type: 'commented',
          actor: { type: 'user', id: owner.userId, name: 'Owner', avatarUrl: null },
          issue: {
            id: issue.id,
            identifier: 'TIP-1',
            title: 'Fix login',
            status: issue.status,
          },
          summary: 'Owner commented',
          readAt: null,
          snoozedUntil: null,
          createdAt: expect.any(Date),
        },
      ],
      nextCursor: null,
    })
  })

  it('notifies the assignee on assign and subscribers on a status change', async () => {
    const { owner, member, team, issue } = await arrange()
    const inProgress = team.statuses.find((s) => s.name === 'In Progress')!
    await owner.client.issues.update({ ...scope, id: issue.id, assigneeId: member.userId })
    await owner.client.issues.update({ ...scope, id: issue.id, statusId: inProgress.id })
    await runNotifyJobs()

    const { items } = await member.client.notifications.list(scope)
    expect(items.map((n) => [n.type, n.summary])).toEqual([
      ['status_changed', 'Owner changed status to In Progress'],
      ['assigned', 'Owner assigned you'],
    ])
    // A retried request or job adds nothing: the job id and (user, source) are unique.
    await runNotifyJobs()
    expect(await member.client.notifications.unreadCount(scope)).toEqual({ count: 2 })
  })

  it('notifies an assignee given on create', async () => {
    const { owner, member, team } = await arrange()
    await owner.client.issues.create({
      ...scope,
      teamId: team.id,
      title: 'Assigned at once',
      assigneeId: member.userId,
    })
    await runNotifyJobs()
    const { items } = await member.client.notifications.list(scope)
    expect(items.map((n) => [n.issue.identifier, n.type])).toEqual([['TIP-2', 'assigned']])
  })

  it('counts unread, marks read / unread and marks all read', async () => {
    const { owner, member, issue } = await arrange()
    for (const body of ['One', 'Two', 'Three']) {
      await owner.client.comments.create({ ...scope, issueId: issue.id, body })
    }
    await runNotifyJobs()
    const api = member.client.notifications
    const { items } = await api.list(scope)
    expect(await api.unreadCount(scope)).toEqual({ count: 3 })

    await api.markRead({ ...scope, id: items[0]!.id })
    expect(await api.unreadCount(scope)).toEqual({ count: 2 })
    expect((await api.list({ ...scope, filter: 'unread' })).items).toHaveLength(2)
    await api.markUnread({ ...scope, id: items[0]!.id })
    expect(await api.unreadCount(scope)).toEqual({ count: 3 })

    expect(await api.markAllRead(scope)).toEqual({ count: 3 })
    expect(await api.unreadCount(scope)).toEqual({ count: 0 })
    expect((await api.list({ ...scope, filter: 'unread' })).items).toEqual([])
    expect((await api.list(scope)).items.every((n) => n.readAt instanceof Date)).toBe(true)
  })

  it('pages newest first with a cursor', async () => {
    const { owner, member, issue } = await arrange()
    for (const body of ['One', 'Two', 'Three']) {
      await owner.client.comments.create({ ...scope, issueId: issue.id, body })
    }
    await runNotifyJobs()
    const api = member.client.notifications
    const all = (await api.list(scope)).items.map((n) => n.id)
    const first = await api.list({ ...scope, limit: 2 })
    const second = await api.list({ ...scope, limit: 2, cursor: first.nextCursor })
    expect([...first.items, ...second.items].map((n) => n.id)).toEqual(all)
    expect(second.nextCursor).toBeNull()
  })

  it('hides snoozed notifications until snoozedUntil, then resurfaces them unread', async () => {
    const { owner, member, issue } = await arrange()
    await owner.client.comments.create({ ...scope, issueId: issue.id, body: 'Ping' })
    await runNotifyJobs()
    const api = member.client.notifications
    const [notification] = (await api.list(scope)).items
    await api.markRead({ ...scope, id: notification!.id })

    const until = new Date(Date.now() + 60 * 60 * 1000)
    await api.snooze({ ...scope, id: notification!.id, until })
    expect((await api.list(scope)).items).toEqual([])
    expect(await api.unreadCount(scope)).toEqual({ count: 0 })

    // Time passes: the snooze ends.
    await db
      .update(notifications)
      .set({ snoozedUntil: new Date(Date.now() - 1000) })
      .where(eq(notifications.id, notification!.id))
    expect((await api.list(scope)).items.map((n) => [n.id, n.readAt])).toEqual([
      [notification!.id, null],
    ])
    expect(await api.unreadCount(scope)).toEqual({ count: 1 })

    await expect(
      api.snooze({ ...scope, id: notification!.id, until: new Date(Date.now() - 1000) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('archives a notification out of the Inbox', async () => {
    const { owner, member, issue } = await arrange()
    await owner.client.comments.create({ ...scope, issueId: issue.id, body: 'Ping' })
    await runNotifyJobs()
    const api = member.client.notifications
    const [notification] = (await api.list(scope)).items
    await expect(api.archive({ ...scope, id: notification!.id })).resolves.toEqual({
      id: notification!.id,
    })
    expect((await api.list(scope)).items).toEqual([])
    expect(await api.unreadCount(scope)).toEqual({ count: 0 })
  })

  it("returns NOT_FOUND for another user's notification and across workspaces", async () => {
    const { owner, member, issue } = await arrange()
    await owner.client.comments.create({ ...scope, issueId: issue.id, body: 'Ping' })
    await runNotifyJobs()
    const [notification] = (await member.client.notifications.list(scope)).items
    const id = notification!.id

    // The owner is in the workspace, but it's not their notification.
    for (const call of [
      () => owner.client.notifications.markRead({ ...scope, id }),
      () => owner.client.notifications.markUnread({ ...scope, id }),
      () => owner.client.notifications.archive({ ...scope, id }),
      () =>
        owner.client.notifications.snooze({ ...scope, id, until: new Date(Date.now() + 60_000) }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }

    // The member's own notification, addressed through another workspace they belong to.
    await member.client.workspaces.create({ name: 'Side', slug: 'side' })
    await expect(
      member.client.notifications.markRead({ workspaceSlug: 'side', id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await member.client.notifications.list({ workspaceSlug: 'side' })).items).toEqual([])

    // Outsiders can't reach the workspace at all.
    const outsider = await signUp(app, 'Outsider')
    await expect(outsider.client.notifications.list(scope)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(rpcClient(app).notifications.unreadCount(scope)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect((await member.client.notifications.list(scope)).items[0]!.readAt).toBeNull()
  })
})
