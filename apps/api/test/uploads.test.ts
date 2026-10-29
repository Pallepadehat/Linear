import { uploads, users } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db, queues, objects } = await setupTestApp()

const PNG = { kind: 'avatar' as const, contentType: 'image/png', size: 1234 }

/** Simulates the browser PUT to the presigned URL. */
async function putObject(uploadId: string, size = PNG.size) {
  const [upload] = await db.select().from(uploads).where(eq(uploads.id, uploadId))
  objects.set(upload!.objectKey, { body: new Uint8Array(size), contentType: upload!.contentType })
}

describe('avatar upload', () => {
  it('presigns, confirms, enqueues processing and sets the avatar', async () => {
    const { client, userId } = await signUp(app)
    const presigned = await client.uploads.createPresignedUpload(PNG)
    expect(presigned).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/png' } })

    const [row] = await db.select().from(uploads).where(eq(uploads.id, presigned.uploadId))
    expect(row).toMatchObject({ status: 'pending', workspaceId: null })
    expect(row!.objectKey).toBe(`users/${userId}/avatar/${presigned.uploadId}/original.png`)

    await putObject(presigned.uploadId)
    await expect(client.uploads.confirm({ uploadId: presigned.uploadId })).resolves.toMatchObject({
      status: 'ready',
    })
    // Confirming twice is a no-op.
    await client.uploads.confirm({ uploadId: presigned.uploadId })
    const jobs = await queues.media.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs.map((j) => [j.name, j.data])).toEqual([
      ['process-image', { uploadId: presigned.uploadId }],
    ])

    const me = await client.me.update({ avatarUploadId: presigned.uploadId })
    expect(me.avatarUrl).toContain(row!.objectKey)
  })

  it('rejects files over the limit before anything is presigned', async () => {
    const { client } = await signUp(app)
    await expect(
      client.uploads.createPresignedUpload({ ...PNG, size: 2 * 1024 * 1024 + 1 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(await db.select().from(uploads)).toHaveLength(0)
  })

  it('rejects confirm when the object is missing or has the wrong size', async () => {
    const { client } = await signUp(app)
    const missing = await client.uploads.createPresignedUpload(PNG)
    await expect(client.uploads.confirm({ uploadId: missing.uploadId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })

    const wrongSize = await client.uploads.createPresignedUpload(PNG)
    await putObject(wrongSize.uploadId, PNG.size + 1)
    await expect(client.uploads.confirm({ uploadId: wrongSize.uploadId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    const [row] = await db.select().from(uploads).where(eq(uploads.id, wrongSize.uploadId))
    expect(row!.status).toBe('deleted')
  })

  it("does not let another user confirm or use someone's upload", async () => {
    const owner = await signUp(app, 'Owner')
    const other = await signUp(app, 'Other')
    const { uploadId } = await owner.client.uploads.createPresignedUpload(PNG)
    await putObject(uploadId)

    await expect(other.client.uploads.confirm({ uploadId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await owner.client.uploads.confirm({ uploadId })
    await expect(other.client.me.update({ avatarUploadId: uploadId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('schedules deletion of the replaced avatar', async () => {
    const { client, userId } = await signUp(app)
    const ids: string[] = []
    for (let i = 0; i < 2; i++) {
      const { uploadId } = await client.uploads.createPresignedUpload(PNG)
      await putObject(uploadId)
      await client.uploads.confirm({ uploadId })
      await client.me.update({ avatarUploadId: uploadId })
      ids.push(uploadId)
    }
    const [first] = await db.select().from(uploads).where(eq(uploads.id, ids[0]!))
    expect(first!.status).toBe('deleted')
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    expect(user!.avatarUploadId).toBe(ids[1])
    const jobs = await queues.maintenance.getJobs(['waiting', 'delayed'])
    expect(jobs.map((j) => j.data)).toEqual([{ uploadId: ids[0] }])
  })

  it('requires authentication', async () => {
    await expect(rpcClient(app).uploads.createPresignedUpload(PNG)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})

describe('upload read access', () => {
  it('shares avatars with co-members only', async () => {
    const owner = await signUp(app, 'Owner')
    const teammate = await signUp(app, 'Teammate')
    const stranger = await signUp(app, 'Stranger')
    const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    await addMember(db, workspace.id, teammate.userId)

    const { uploadId } = await owner.client.uploads.createPresignedUpload(PNG)
    await putObject(uploadId)
    await owner.client.uploads.confirm({ uploadId })

    await expect(teammate.client.uploads.getUrl({ uploadId })).resolves.toHaveProperty('url')
    await expect(stranger.client.uploads.getUrl({ uploadId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('keeps workspace files inside the workspace', async () => {
    const owner = await signUp(app, 'Owner')
    const stranger = await signUp(app, 'Stranger')
    await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    const { uploadId } = await owner.client.uploads.createPresignedUpload({
      kind: 'project_icon',
      contentType: 'image/png',
      size: 100,
      workspaceSlug: 'tip',
    })
    await putObject(uploadId, 100)
    await owner.client.uploads.confirm({ uploadId })

    await expect(owner.client.uploads.getUrl({ uploadId })).resolves.toHaveProperty('url')
    await expect(stranger.client.uploads.getUrl({ uploadId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      stranger.client.uploads.createPresignedUpload({
        kind: 'project_icon',
        contentType: 'image/png',
        size: 100,
        workspaceSlug: 'tip',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('only lets owners upload a workspace icon', async () => {
    const owner = await signUp(app, 'Owner')
    const member = await signUp(app, 'Member')
    const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    await addMember(db, workspace.id, member.userId)
    const icon = {
      kind: 'workspace_icon' as const,
      contentType: 'image/png',
      size: 100,
      workspaceSlug: 'tip',
    }

    await expect(owner.client.uploads.createPresignedUpload(icon)).resolves.toHaveProperty(
      'uploadId',
    )
    await expect(member.client.uploads.createPresignedUpload(icon)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
