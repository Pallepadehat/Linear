import { createComment, createIssue, subscribeUsers, updateIssue } from '@linear/core'
import { issueSubscriptions } from '@linear/db'
import { addMember, createTeam, createUser, createWorkspace } from '@linear/db/testing'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function subscriberIds(issueId: string) {
  const rows = await db
    .select({ userId: issueSubscriptions.userId })
    .from(issueSubscriptions)
    .where(eq(issueSubscriptions.issueId, issueId))
    .orderBy(asc(issueSubscriptions.id))
  return rows.map((row) => row.userId)
}

async function arrange() {
  const owner = await createUser(db)
  const member = await createUser(db)
  const workspace = await createWorkspace(db, { ownerId: owner.id })
  await addMember(db, workspace.id, member.id)
  const team = await createTeam(db, { workspaceId: workspace.id, key: 'TIP' })
  const create = (input: { assigneeId?: string | null } = {}) =>
    createIssue(db, {
      workspaceId: workspace.id,
      teamId: team.id,
      creatorId: owner.id,
      title: 'Fix login',
      ...input,
    })
  return { owner, member, workspace, team, create }
}

describe('auto-subscribe (core)', () => {
  it('subscribes the creator and the assignee on create', async () => {
    const { owner, member, create } = await arrange()
    expect(await subscriberIds((await create()).id)).toEqual([owner.id])
    expect(new Set(await subscriberIds((await create({ assigneeId: member.id })).id))).toEqual(
      new Set([owner.id, member.id]),
    )
  })

  it('subscribes a new assignee, but not again after they unsubscribed', async () => {
    const { owner, member, workspace, create } = await arrange()
    const issue = await create()
    const assign = (assigneeId: string | null) =>
      updateIssue(db, {
        workspaceId: workspace.id,
        id: issue.id,
        actor: { type: 'user', id: owner.id },
        assigneeId,
      })

    await assign(member.id)
    expect(await subscriberIds(issue.id)).toEqual([owner.id, member.id])

    await db.delete(issueSubscriptions).where(eq(issueSubscriptions.userId, member.id))
    await assign(member.id)
    expect(await subscriberIds(issue.id)).toEqual([owner.id])

    await assign(null)
    await assign(member.id)
    expect(await subscriberIds(issue.id)).toEqual([owner.id, member.id])
  })

  it('subscribes the author of a comment', async () => {
    const { owner, member, workspace, create } = await arrange()
    const issue = await create()
    await createComment(db, {
      workspaceId: workspace.id,
      issueId: issue.id,
      authorId: member.id,
      body: 'On it',
    })
    expect(await subscriberIds(issue.id)).toEqual([owner.id, member.id])
  })

  it('runs in the same transaction as the write', async () => {
    const { owner, member, workspace, create } = await arrange()
    const issue = await create()
    const rollback = new Error('rollback')

    await expect(
      db.transaction(async (tx) => {
        await createComment(tx, {
          workspaceId: workspace.id,
          issueId: issue.id,
          authorId: member.id,
          body: 'On it',
        })
        await updateIssue(tx, {
          workspaceId: workspace.id,
          id: issue.id,
          actor: { type: 'user', id: owner.id },
          assigneeId: member.id,
        })
        expect(await tx.select().from(issueSubscriptions)).toHaveLength(2)
        throw rollback
      }),
    ).rejects.toBe(rollback)

    expect(await subscriberIds(issue.id)).toEqual([owner.id])
  })

  it('subscribeUsers is idempotent and skips non-members', async () => {
    const { owner, member, create } = await arrange()
    const outsider = await createUser(db)
    const issue = await create()

    await subscribeUsers(db, issue.id, [member.id, member.id, outsider.id, null])
    await subscribeUsers(db, issue.id, [owner.id, member.id])

    expect(await subscriberIds(issue.id)).toEqual([owner.id, member.id])
  })
})

async function issueInTip() {
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
  return { owner, member, workspace, team, issue }
}

describe('issue subscription procedures', () => {
  it('subscribe and unsubscribe are idempotent and reflected in isSubscribed', async () => {
    const { member, issue } = await issueInTip()
    const input = { workspaceSlug: 'tip', issueId: issue.id }
    const isSubscribed = async () =>
      (await member.client.issues.get({ workspaceSlug: 'tip', id: issue.id })).isSubscribed

    expect(issue.isSubscribed).toBe(true)
    expect(await isSubscribed()).toBe(false)

    expect(await member.client.issues.subscribe(input)).toEqual({ subscribed: true })
    expect(await member.client.issues.subscribe(input)).toEqual({ subscribed: true })
    expect(await isSubscribed()).toBe(true)

    expect(await member.client.issues.unsubscribe(input)).toEqual({ subscribed: false })
    expect(await member.client.issues.unsubscribe(input)).toEqual({ subscribed: false })
    expect(await isSubscribed()).toBe(false)
  })

  it('lists subscribers and lets a member add or remove someone else', async () => {
    const { owner, member, issue } = await issueInTip()
    const input = { workspaceSlug: 'tip', issueId: issue.id }

    await owner.client.issues.subscribe({ ...input, userId: member.userId })
    expect(await member.client.issues.subscribers(input)).toEqual([
      { id: owner.userId, name: 'Owner', email: owner.email, avatarUrl: null },
      { id: member.userId, name: 'Member', email: member.email, avatarUrl: null },
    ])

    await member.client.issues.unsubscribe({ ...input, userId: owner.userId })
    expect((await owner.client.issues.subscribers(input)).map((u) => u.id)).toEqual([member.userId])
  })

  it('refuses to subscribe someone outside the workspace', async () => {
    const { owner, issue } = await issueInTip()
    const stranger = await signUp(app, 'Stranger')
    await expect(
      owner.client.issues.subscribe({
        workspaceSlug: 'tip',
        issueId: issue.id,
        userId: stranger.userId,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('returns NOT_FOUND for an issue in another workspace, UNAUTHORIZED when signed out', async () => {
    const { issue } = await issueInTip()
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const input = { workspaceSlug: 'mine', issueId: issue.id }
    const notFound = { code: 'NOT_FOUND' }

    await expect(stranger.client.issues.subscribe(input)).rejects.toMatchObject(notFound)
    await expect(stranger.client.issues.unsubscribe(input)).rejects.toMatchObject(notFound)
    await expect(stranger.client.issues.subscribers(input)).rejects.toMatchObject(notFound)
    expect(await subscriberIds(issue.id)).toHaveLength(1)

    await expect(
      rpcClient(app).issues.subscribe({ workspaceSlug: 'tip', issueId: issue.id }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('filters the list by subscriber, with me for the signed-in user', async () => {
    const { owner, member, team, issue: ownerIssue } = await issueInTip()
    const memberIssue = await member.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Member issue',
    })
    await owner.client.issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'Third' })
    await owner.client.issues.unsubscribe({ workspaceSlug: 'tip', issueId: ownerIssue.id })
    await member.client.issues.subscribe({ workspaceSlug: 'tip', issueId: ownerIssue.id })

    const ids = async (client: typeof owner.client, subscriberIds: string[]) =>
      (await client.issues.list({ workspaceSlug: 'tip', subscriberIds })).items
        .map((i) => i.id)
        .sort()

    expect(await ids(member.client, ['me'])).toEqual([ownerIssue.id, memberIssue.id].sort())
    expect(await ids(owner.client, [member.userId])).toEqual([ownerIssue.id, memberIssue.id].sort())
    const mine = await owner.client.issues.list({ workspaceSlug: 'tip', subscriberIds: ['me'] })
    expect(mine.items.map((i) => i.title)).toEqual(['Third'])
    expect(mine.items.every((i) => i.isSubscribed)).toBe(true)
  })
})
