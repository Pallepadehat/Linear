import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function workspaceWithOwner() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  return { owner, workspace }
}

describe('labels', () => {
  it('lets a member create, list, update and delete labels', async () => {
    const { workspace } = await workspaceWithOwner()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const labels = member.client.labels

    const bug = await labels.create({ workspaceSlug: 'tip', name: ' Bug ', color: '#EB5757' })
    expect(bug).toEqual({ id: bug.id, name: 'Bug', color: '#eb5757' })
    const feature = await labels.create({ workspaceSlug: 'tip', name: 'Feature', color: '#5e6ad2' })

    expect(await labels.list({ workspaceSlug: 'tip' })).toEqual([bug, feature])

    const renamed = await labels.update({ workspaceSlug: 'tip', id: bug.id, name: 'Defect' })
    expect(renamed).toEqual({ id: bug.id, name: 'Defect', color: '#eb5757' })
    await expect(
      labels.update({ workspaceSlug: 'tip', id: bug.id, color: '#27a644' }),
    ).resolves.toMatchObject({ name: 'Defect', color: '#27a644' })

    await expect(labels.delete({ workspaceSlug: 'tip', id: bug.id })).resolves.toEqual({
      id: bug.id,
    })
    expect(await labels.list({ workspaceSlug: 'tip' })).toEqual([feature])
    await expect(labels.delete({ workspaceSlug: 'tip', id: bug.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('rejects duplicate names within a workspace on create and rename', async () => {
    const { owner } = await workspaceWithOwner()
    await owner.client.workspaces.create({ name: 'Other', slug: 'other' })
    const labels = owner.client.labels
    await labels.create({ workspaceSlug: 'tip', name: 'Bug', color: '#eb5757' })
    const feature = await labels.create({ workspaceSlug: 'tip', name: 'Feature', color: '#5e6ad2' })

    await expect(
      labels.create({ workspaceSlug: 'tip', name: 'Bug', color: '#000000' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      labels.update({ workspaceSlug: 'tip', id: feature.id, name: 'Bug' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(
      labels.create({ workspaceSlug: 'other', name: 'Bug', color: '#eb5757' }),
    ).resolves.toBeTruthy()
  })

  it('rejects invalid colors', async () => {
    const { owner } = await workspaceWithOwner()
    await expect(
      owner.client.labels.create({ workspaceSlug: 'tip', name: 'Bug', color: 'red' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('hides labels from non-members and other workspaces', async () => {
    const { owner } = await workspaceWithOwner()
    const bug = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'Bug',
      color: '#eb5757',
    })
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })

    await expect(rpcClient(app).labels.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    await expect(stranger.client.labels.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      stranger.client.labels.create({ workspaceSlug: 'tip', name: 'X', color: '#000000' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // A label id from another workspace is invisible through the stranger's own workspace.
    await expect(
      stranger.client.labels.update({ workspaceSlug: 'mine', id: bug.id, name: 'Hijacked' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      stranger.client.labels.delete({ workspaceSlug: 'mine', id: bug.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await owner.client.labels.list({ workspaceSlug: 'tip' })).toEqual([bug])
  })
})
