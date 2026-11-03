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
    expect(bug).toEqual({ id: bug.id, teamId: null, name: 'Bug', color: '#eb5757' })
    const feature = await labels.create({ workspaceSlug: 'tip', name: 'Feature', color: '#5e6ad2' })

    expect(await labels.list({ workspaceSlug: 'tip' })).toEqual([bug, feature])

    const renamed = await labels.update({ workspaceSlug: 'tip', id: bug.id, name: 'Defect' })
    expect(renamed).toEqual({ id: bug.id, teamId: null, name: 'Defect', color: '#eb5757' })
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

  describe('team labels', () => {
    async function twoTeams() {
      const { owner } = await workspaceWithOwner()
      const tip = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
      const ops = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Ops', key: 'OPS' })
      return { owner, tip, ops, labels: owner.client.labels }
    }

    it('creates a team label next to workspace labels of the same name', async () => {
      const { tip, ops, labels } = await twoTeams()
      const shared = await labels.create({ workspaceSlug: 'tip', name: 'Bug', color: '#eb5757' })
      const tipBug = await labels.create({
        workspaceSlug: 'tip',
        teamId: tip.id,
        name: 'Bug',
        color: '#eb5757',
      })
      expect(shared.teamId).toBeNull()
      expect(tipBug).toMatchObject({ teamId: tip.id, name: 'Bug' })
      // The same name in another team is its own label.
      await expect(
        labels.create({ workspaceSlug: 'tip', teamId: ops.id, name: 'Bug', color: '#eb5757' }),
      ).resolves.toMatchObject({ teamId: ops.id })
    })

    it('rejects a duplicate name within the same team', async () => {
      const { tip, labels } = await twoTeams()
      await labels.create({ workspaceSlug: 'tip', teamId: tip.id, name: 'Bug', color: '#eb5757' })
      await expect(
        labels.create({ workspaceSlug: 'tip', teamId: tip.id, name: 'Bug', color: '#000000' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
      const other = await labels.create({
        workspaceSlug: 'tip',
        teamId: tip.id,
        name: 'Other',
        color: '#000000',
      })
      await expect(
        labels.update({ workspaceSlug: 'tip', id: other.id, name: 'Bug' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('returns NOT_FOUND for a team from another workspace', async () => {
      const { labels } = await twoTeams()
      const stranger = await signUp(app, 'Stranger')
      await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
      const foreign = await stranger.client.teams.create({
        workspaceSlug: 'mine',
        name: 'Mine',
        key: 'MINE',
      })
      await expect(
        labels.create({ workspaceSlug: 'tip', teamId: foreign.id, name: 'X', color: '#000000' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('lists workspace labels plus the requested team', async () => {
      const { tip, ops, labels } = await twoTeams()
      const shared = await labels.create({ workspaceSlug: 'tip', name: 'Shared', color: '#000000' })
      const tipOnly = await labels.create({
        workspaceSlug: 'tip',
        teamId: tip.id,
        name: 'Frontend',
        color: '#000000',
      })
      const opsOnly = await labels.create({
        workspaceSlug: 'tip',
        teamId: ops.id,
        name: 'Infra',
        color: '#000000',
      })

      expect(await labels.list({ workspaceSlug: 'tip', teamId: tip.id })).toEqual([tipOnly, shared])
      expect(await labels.list({ workspaceSlug: 'tip', teamId: ops.id })).toEqual([opsOnly, shared])
      expect(await labels.list({ workspaceSlug: 'tip' })).toEqual([tipOnly, opsOnly, shared])
    })

    it("only applies a team label to that team's issues", async () => {
      const { tip, ops, labels, owner } = await twoTeams()
      const opsOnly = await labels.create({
        workspaceSlug: 'tip',
        teamId: ops.id,
        name: 'Infra',
        color: '#000000',
      })
      await expect(
        owner.client.issues.create({
          workspaceSlug: 'tip',
          teamId: tip.id,
          title: 'Wrong team',
          labelIds: [opsOnly.id],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      await expect(
        owner.client.issues.create({
          workspaceSlug: 'tip',
          teamId: ops.id,
          title: 'Right team',
          labelIds: [opsOnly.id],
        }),
      ).resolves.toMatchObject({ labels: [opsOnly] })
    })
  })
})
