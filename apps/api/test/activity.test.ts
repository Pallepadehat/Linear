import { activityLog } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function issueInTip() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const status = (name: string) => team.statuses.find((s) => s.name === name)!
  const issue = await owner.client.issues.create({
    workspaceSlug: 'tip',
    teamId: team.id,
    title: 'Fix login',
  })
  const list = (cursor?: string | null, limit?: number) =>
    owner.client.activity.list({ workspaceSlug: 'tip', issueId: issue.id, cursor, limit })
  return { owner, workspace, issue, status, list, issues: owner.client.issues }
}

describe('activity.list', () => {
  it('logs creation with the creator as actor', async () => {
    const { owner, issue, list } = await issueInTip()

    expect((await list()).items).toEqual([
      {
        id: expect.any(String),
        issueId: issue.id,
        actorType: 'user',
        actorId: owner.userId,
        pullRequestId: null,
        kind: 'created',
        from: null,
        to: null,
        mentionedIn: null,
        createdAt: expect.any(Date),
      },
    ])
  })

  it('writes one entry per changed field with from and to, attributed to the editor', async () => {
    const { workspace, issue, status, list } = await issueInTip()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)

    await member.client.issues.update({
      workspaceSlug: 'tip',
      id: issue.id,
      statusId: status('In Progress').id,
      priority: 2,
    })

    const { items } = await list()
    expect(items.slice(1)).toEqual([
      expect.objectContaining({
        actorType: 'user',
        actorId: member.userId,
        kind: 'status',
        from: status('Backlog').id,
        to: status('In Progress').id,
      }),
      expect.objectContaining({
        actorType: 'user',
        actorId: member.userId,
        kind: 'priority',
        from: 0,
        to: 2,
      }),
    ])
  })

  it('writes nothing when fields are set to the values they already had', async () => {
    const { owner, issue, status, list, issues } = await issueInTip()
    const bug = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'Bug',
      color: '#eb5757',
    })
    await issues.update({ workspaceSlug: 'tip', id: issue.id, labelIds: [bug.id] })
    const before = (await list()).items

    await issues.update({
      workspaceSlug: 'tip',
      id: issue.id,
      title: '  Fix login ',
      description: null,
      statusId: status('Backlog').id,
      priority: 0,
      assigneeId: null,
      labelIds: [bug.id, bug.id],
    })

    expect((await list()).items).toEqual(before)
    expect(before.map((entry) => entry.kind)).toEqual(['created', 'labels'])
    expect(before[1]).toMatchObject({ from: [], to: [bug.id] })
  })

  it('pages oldest first with stable cursors', async () => {
    const { issue, list, issues } = await issueInTip()
    for (const title of ['B', 'C', 'D', 'E']) {
      await issues.update({ workspaceSlug: 'tip', id: issue.id, title })
    }

    const first = await list(null, 2)
    expect(first.items.map((e) => e.to)).toEqual([null, 'B'])
    const second = await list(first.nextCursor, 2)
    expect(second.items.map((e) => e.to)).toEqual(['C', 'D'])
    const third = await list(second.nextCursor, 2)
    expect(third).toMatchObject({
      items: [{ kind: 'title', from: 'D', to: 'E' }],
      nextCursor: null,
    })
    await expect(list('not-a-cursor')).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rolls back the entries with a failed update', async () => {
    const { issue, issues } = await issueInTip()

    await expect(
      issues.update({
        workspaceSlug: 'tip',
        id: issue.id,
        title: 'B',
        priority: 1,
        projectId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const rows = await db.select().from(activityLog).where(eq(activityLog.issueId, issue.id))
    expect(rows.map((row) => row.kind)).toEqual(['created'])
  })

  it('hides activity from non-members and other workspaces', async () => {
    const { issue } = await issueInTip()
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const notFound = { code: 'NOT_FOUND' }

    await expect(
      rpcClient(app).activity.list({ workspaceSlug: 'tip', issueId: issue.id }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(
      stranger.client.activity.list({ workspaceSlug: 'tip', issueId: issue.id }),
    ).rejects.toMatchObject(notFound)
    await expect(
      stranger.client.activity.list({ workspaceSlug: 'mine', issueId: issue.id }),
    ).rejects.toMatchObject(notFound)
  })
})
