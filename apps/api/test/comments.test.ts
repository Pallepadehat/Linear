import { comments } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

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
  return { owner, member, workspace, issue }
}

describe('comments', () => {
  it('creates a comment with its author and lists it', async () => {
    const { member, issue } = await issueInTip()

    const comment = await member.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: '  Looks good  ',
    })

    expect(comment).toEqual({
      id: expect.any(String),
      issueId: issue.id,
      author: { id: member.userId, name: 'Member', avatarUrl: null },
      body: 'Looks good',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    expect(await member.client.comments.list({ workspaceSlug: 'tip', issueId: issue.id })).toEqual({
      items: [comment],
      nextCursor: null,
    })
  })

  it('pages oldest first', async () => {
    const { owner, issue } = await issueInTip()
    for (const body of ['A', 'B', 'C']) {
      await owner.client.comments.create({ workspaceSlug: 'tip', issueId: issue.id, body })
    }
    const list = (cursor?: string | null) =>
      owner.client.comments.list({ workspaceSlug: 'tip', issueId: issue.id, cursor, limit: 2 })

    const first = await list()
    expect(first.items.map((c) => c.body)).toEqual(['A', 'B'])
    const second = await list(first.nextCursor)
    expect(second).toMatchObject({ items: [{ body: 'C' }], nextCursor: null })
    await expect(list('not-a-cursor')).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rejects an empty body', async () => {
    const { owner, issue } = await issueInTip()
    await expect(
      owner.client.comments.create({ workspaceSlug: 'tip', issueId: issue.id, body: '   ' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('lets the author edit their comment', async () => {
    const { member, issue } = await issueInTip()
    const comment = await member.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: 'Frist',
    })

    const updated = await member.client.comments.update({
      workspaceSlug: 'tip',
      id: comment.id,
      body: 'First',
    })

    expect(updated).toMatchObject({ id: comment.id, body: 'First', createdAt: comment.createdAt })
    expect(updated.updatedAt.getTime()).toBeGreaterThan(comment.updatedAt.getTime())
  })

  it("forbids editing someone else's comment, even for owners", async () => {
    const { owner, member, issue } = await issueInTip()
    const comment = await member.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: 'Mine',
    })

    await expect(
      owner.client.comments.update({ workspaceSlug: 'tip', id: comment.id, body: 'Ours' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it("lets authors delete their comments; members can't delete others', owners can", async () => {
    const { owner, member, issue } = await issueInTip()
    const create = (client: typeof owner.client, body: string) =>
      client.comments.create({ workspaceSlug: 'tip', issueId: issue.id, body })
    const byOwner = await create(owner.client, 'Owner note')
    const byMember = await create(member.client, 'Member note')
    const other = await create(member.client, 'Another')

    await expect(
      member.client.comments.delete({ workspaceSlug: 'tip', id: byOwner.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await member.client.comments.delete({ workspaceSlug: 'tip', id: byMember.id })).toEqual({
      id: byMember.id,
    })
    expect(await owner.client.comments.delete({ workspaceSlug: 'tip', id: other.id })).toEqual({
      id: other.id,
    })

    const { items } = await owner.client.comments.list({ workspaceSlug: 'tip', issueId: issue.id })
    expect(items.map((c) => c.id)).toEqual([byOwner.id])
  })

  it('removes comments with their issue', async () => {
    const { owner, issue } = await issueInTip()
    await owner.client.comments.create({ workspaceSlug: 'tip', issueId: issue.id, body: 'Bye' })

    await owner.client.issues.delete({ workspaceSlug: 'tip', id: issue.id })

    expect(await db.select().from(comments).where(eq(comments.issueId, issue.id))).toEqual([])
  })

  it('hides comments in other workspaces', async () => {
    const { owner, issue } = await issueInTip()
    const comment = await owner.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: 'Secret',
    })
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const notFound = { code: 'NOT_FOUND' }

    await expect(
      rpcClient(app).comments.list({ workspaceSlug: 'tip', issueId: issue.id }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    for (const workspaceSlug of ['tip', 'mine']) {
      await expect(
        stranger.client.comments.create({ workspaceSlug, issueId: issue.id, body: 'Hi' }),
      ).rejects.toMatchObject(notFound)
      await expect(
        stranger.client.comments.list({ workspaceSlug, issueId: issue.id }),
      ).rejects.toMatchObject(notFound)
      await expect(
        stranger.client.comments.update({ workspaceSlug, id: comment.id, body: 'Hi' }),
      ).rejects.toMatchObject(notFound)
      await expect(
        stranger.client.comments.delete({ workspaceSlug, id: comment.id }),
      ).rejects.toMatchObject(notFound)
    }
  })
})
