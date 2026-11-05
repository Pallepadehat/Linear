import { commentAttachments, comments, uploads } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db, queues, objects } = await setupTestApp()

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
      parentId: null,
      author: { id: member.userId, name: 'Member', avatarUrl: null },
      body: 'Looks good',
      reactions: [],
      resolvedAt: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
    expect(await member.client.comments.list({ workspaceSlug: 'tip', issueId: issue.id })).toEqual({
      items: [{ ...comment, replies: [], replyCount: 0 }],
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
      const reaction = { workspaceSlug, commentId: comment.id, emoji: '👍' } as const
      await expect(stranger.client.comments.react(reaction)).rejects.toMatchObject(notFound)
      await expect(stranger.client.comments.unreact(reaction)).rejects.toMatchObject(notFound)
      await expect(
        stranger.client.comments.resolveThread({ workspaceSlug, id: comment.id }),
      ).rejects.toMatchObject(notFound)
      await expect(
        stranger.client.comments.unresolveThread({ workspaceSlug, id: comment.id }),
      ).rejects.toMatchObject(notFound)
    }
    // A parent from another workspace is unknown here, even on an issue the user can see.
    const theirTeam = await stranger.client.teams.create({
      workspaceSlug: 'mine',
      name: 'Mine',
      key: 'MIN',
    })
    const theirIssue = await stranger.client.issues.create({
      workspaceSlug: 'mine',
      teamId: theirTeam.id,
      title: 'Theirs',
    })
    await expect(
      stranger.client.comments.create({
        workspaceSlug: 'mine',
        issueId: theirIssue.id,
        parentId: comment.id,
        body: 'Hi',
      }),
    ).rejects.toMatchObject(notFound)
  })

  describe('threads', () => {
    it('nests replies under their root and pages over roots only', async () => {
      const { owner, member, issue } = await issueInTip()
      const create = (client: typeof owner.client, body: string, parentId?: string) =>
        client.comments.create({ workspaceSlug: 'tip', issueId: issue.id, body, parentId })
      const first = await create(owner.client, 'First')
      const reply1 = await create(member.client, 'Reply 1', first.id)
      const second = await create(member.client, 'Second')
      const reply2 = await create(owner.client, 'Reply 2', first.id)

      expect(reply1).toMatchObject({ parentId: first.id, reactions: [], resolvedAt: null })
      const page = await owner.client.comments.list({
        workspaceSlug: 'tip',
        issueId: issue.id,
        limit: 1,
      })
      expect(page.items).toEqual([{ ...first, replies: [reply1, reply2], replyCount: 2 }])
      const next = await owner.client.comments.list({
        workspaceSlug: 'tip',
        issueId: issue.id,
        cursor: page.nextCursor,
      })
      expect(next).toEqual({ items: [{ ...second, replies: [], replyCount: 0 }], nextCursor: null })
    })

    it('rejects a reply to a reply and a parent on another issue', async () => {
      const { owner, issue } = await issueInTip()
      const root = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        body: 'Root',
      })
      const reply = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        parentId: root.id,
        body: 'Reply',
      })
      const other = await owner.client.issues.create({
        workspaceSlug: 'tip',
        teamId: issue.teamId,
        title: 'Other',
      })

      await expect(
        owner.client.comments.create({
          workspaceSlug: 'tip',
          issueId: issue.id,
          parentId: reply.id,
          body: 'Nested',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      await expect(
        owner.client.comments.create({
          workspaceSlug: 'tip',
          issueId: other.id,
          parentId: root.id,
          body: 'Elsewhere',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('deletes replies with their root', async () => {
      const { owner, issue } = await issueInTip()
      const root = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        body: 'Root',
      })
      await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        parentId: root.id,
        body: 'Reply',
      })

      await owner.client.comments.delete({ workspaceSlug: 'tip', id: root.id })

      expect(await db.select().from(comments).where(eq(comments.issueId, issue.id))).toEqual([])
    })

    it('resolves and reopens a thread; a reply reopens it too', async () => {
      const { owner, member, issue } = await issueInTip()
      const root = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        body: 'Root',
      })
      const reply = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        parentId: root.id,
        body: 'Reply',
      })
      const byId = { workspaceSlug: 'tip', id: root.id }

      const resolved = await member.client.comments.resolveThread(byId)
      expect(resolved.resolvedAt).toBeInstanceOf(Date)
      // Resolving isn't an edit.
      expect(resolved.updatedAt).toEqual(root.updatedAt)
      expect(await member.client.comments.resolveThread(byId)).toEqual(resolved)
      expect(await member.client.comments.unresolveThread(byId)).toMatchObject({
        resolvedAt: null,
      })
      await expect(
        member.client.comments.resolveThread({ workspaceSlug: 'tip', id: reply.id }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

      await member.client.comments.resolveThread(byId)
      await member.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        parentId: root.id,
        body: 'Actually…',
      })
      const { items } = await owner.client.comments.list({
        workspaceSlug: 'tip',
        issueId: issue.id,
      })
      expect(items[0]).toMatchObject({ id: root.id, resolvedAt: null, replyCount: 2 })
    })
  })

  describe('reactions', () => {
    it('counts reactions per emoji with reactedByMe per user, idempotently', async () => {
      const { owner, member, issue } = await issueInTip()
      const comment = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        body: 'Ship it',
      })
      const react = (client: typeof owner.client, emoji: '👍' | '🚀') =>
        client.comments.react({ workspaceSlug: 'tip', commentId: comment.id, emoji })
      const unreact = (client: typeof owner.client, emoji: '👍' | '🚀') =>
        client.comments.unreact({ workspaceSlug: 'tip', commentId: comment.id, emoji })

      await react(owner.client, '🚀')
      await react(owner.client, '👍')
      // Twice is the same as once.
      await react(member.client, '👍')
      const afterMember = await react(member.client, '👍')

      expect(afterMember.reactions).toEqual([
        { emoji: '🚀', count: 1, reactedByMe: false },
        { emoji: '👍', count: 2, reactedByMe: true },
      ])
      const listed = async (client: typeof owner.client) =>
        (await client.comments.list({ workspaceSlug: 'tip', issueId: issue.id })).items[0]!
          .reactions
      expect(await listed(owner.client)).toEqual([
        { emoji: '🚀', count: 1, reactedByMe: true },
        { emoji: '👍', count: 2, reactedByMe: true },
      ])

      await unreact(owner.client, '👍')
      const again = await unreact(owner.client, '👍')
      expect(again.reactions).toEqual([
        { emoji: '🚀', count: 1, reactedByMe: true },
        { emoji: '👍', count: 1, reactedByMe: false },
      ])
      await unreact(owner.client, '🚀')
      expect(await listed(member.client)).toEqual([{ emoji: '👍', count: 1, reactedByMe: true }])
    })

    it('includes reactions on replies and rejects emojis outside the allowlist', async () => {
      const { owner, issue } = await issueInTip()
      const root = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        body: 'Root',
      })
      const reply = await owner.client.comments.create({
        workspaceSlug: 'tip',
        issueId: issue.id,
        parentId: root.id,
        body: 'Reply',
      })
      await owner.client.comments.react({ workspaceSlug: 'tip', commentId: reply.id, emoji: '🎉' })

      const { items } = await owner.client.comments.list({
        workspaceSlug: 'tip',
        issueId: issue.id,
      })
      expect(items[0]?.reactions).toEqual([])
      expect(items[0]?.replies[0]?.reactions).toEqual([
        { emoji: '🎉', count: 1, reactedByMe: true },
      ])
      await expect(
        owner.client.comments.react({
          workspaceSlug: 'tip',
          commentId: root.id,
          // @ts-expect-error not an allowed reaction
          emoji: 'lol',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })
  })
})

describe('comment attachments', () => {
  type Client = Awaited<ReturnType<typeof signUp>>['client']

  /** Presigns, "uploads" and confirms a ready image attachment in the workspace. */
  async function readyImage(client: Client, workspaceSlug = 'tip') {
    const { uploadId } = await client.uploads.createPresignedUpload({
      kind: 'attachment',
      contentType: 'image/png',
      size: 10,
      workspaceSlug,
    })
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, uploadId))
    objects.set(upload!.objectKey, { body: new Uint8Array(10), contentType: upload!.contentType })
    await client.uploads.confirm({ uploadId })
    return uploadId
  }

  const image = (uploadId: string) => `![shot.png](attachment:${uploadId})`

  async function linkedUploadIds(commentId: string) {
    const rows = await db
      .select({ uploadId: commentAttachments.uploadId })
      .from(commentAttachments)
      .where(eq(commentAttachments.commentId, commentId))
    return rows.map((row) => row.uploadId).sort()
  }

  async function uploadStatus(uploadId: string) {
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, uploadId))
    return upload!.status
  }

  async function deleteJobs() {
    const jobs = await queues.maintenance.getJobs(['waiting', 'delayed'])
    return jobs.filter((job) => job.name === 'delete-objects').map((job) => job.data.uploadId)
  }

  it('links images on create and edit, and deletes them with the comment', async () => {
    const { member, issue } = await issueInTip()
    const [a, b] = [await readyImage(member.client), await readyImage(member.client)]

    const comment = await member.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: `Before ${image(a)}`,
    })
    expect(await linkedUploadIds(comment.id)).toEqual([a])

    await member.client.comments.update({
      workspaceSlug: 'tip',
      id: comment.id,
      body: `After ${image(b)}`,
    })
    expect(await linkedUploadIds(comment.id)).toEqual([b])
    // Unlinked but kept for the sweep's grace period.
    expect(await uploadStatus(a)).toBe('ready')

    await member.client.comments.delete({ workspaceSlug: 'tip', id: comment.id })
    expect(await uploadStatus(b)).toBe('deleted')
    expect(await deleteJobs()).toEqual([b])
  })

  it("releases replies' images with their root and the issue's comment images with the issue", async () => {
    const { owner, issue } = await issueInTip()
    const [a, b] = [await readyImage(owner.client), await readyImage(owner.client)]
    const root = await owner.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: 'Root',
    })
    await owner.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      parentId: root.id,
      body: image(a),
    })
    await owner.client.comments.delete({ workspaceSlug: 'tip', id: root.id })
    expect(await uploadStatus(a)).toBe('deleted')

    await owner.client.comments.create({ workspaceSlug: 'tip', issueId: issue.id, body: image(b) })
    await owner.client.issues.delete({ workspaceSlug: 'tip', id: issue.id })
    expect(await uploadStatus(b)).toBe('deleted')
    expect((await deleteJobs()).sort()).toEqual([a, b].sort())
  })

  it('keeps an image another comment or the issue description still links', async () => {
    const { owner, issue } = await issueInTip()
    const a = await readyImage(owner.client)
    const input = { workspaceSlug: 'tip', issueId: issue.id, body: image(a) }
    const first = await owner.client.comments.create(input)
    await owner.client.comments.create(input)

    await owner.client.comments.delete({ workspaceSlug: 'tip', id: first.id })
    expect(await uploadStatus(a)).toBe('ready')
    expect(await deleteJobs()).toEqual([])
  })

  it('rejects images that are not ready attachments in the workspace', async () => {
    const { owner, issue } = await issueInTip()
    await owner.client.workspaces.create({ name: 'Other', slug: 'other' })
    const foreign = await readyImage(owner.client, 'other')
    const { uploadId: pending } = await owner.client.uploads.createPresignedUpload({
      kind: 'attachment',
      contentType: 'image/png',
      size: 10,
      workspaceSlug: 'tip',
    })
    const comment = await owner.client.comments.create({
      workspaceSlug: 'tip',
      issueId: issue.id,
      body: 'Plain',
    })

    for (const uploadId of [foreign, pending, '01890a5d-ac96-774b-bcce-b302099a8057']) {
      await expect(
        owner.client.comments.create({
          workspaceSlug: 'tip',
          issueId: issue.id,
          body: image(uploadId),
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      await expect(
        owner.client.comments.update({
          workspaceSlug: 'tip',
          id: comment.id,
          body: image(uploadId),
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
    const list = await owner.client.comments.list({ workspaceSlug: 'tip', issueId: issue.id })
    expect(list.items.map((c) => c.body)).toEqual(['Plain'])
    expect(await uploadStatus(foreign)).toBe('ready')
  })
})
