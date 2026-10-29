import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function workspaceWithOwner() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  return { owner, workspace }
}

describe('teams', () => {
  it('lets a member create a team with default statuses', async () => {
    const { workspace } = await workspaceWithOwner()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)

    const team = await member.client.teams.create({
      workspaceSlug: 'tip',
      name: 'Tip Development',
      key: 'TIP',
    })
    expect(team).toMatchObject({ key: 'TIP', name: 'Tip Development' })
    expect(team.statuses.map((s) => s.name)).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'Done',
      'Canceled',
    ])

    expect(await member.client.teams.list({ workspaceSlug: 'tip' })).toEqual([
      { id: team.id, name: 'Tip Development', key: 'TIP' },
    ])
  })

  it('keeps team keys unique within a workspace, case-insensitively', async () => {
    const { owner } = await workspaceWithOwner()
    await owner.client.teams.create({ workspaceSlug: 'tip', name: 'One', key: 'TIP' })
    await expect(
      owner.client.teams.create({ workspaceSlug: 'tip', name: 'Two', key: 'tip' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('allows the same key in different workspaces', async () => {
    const { owner } = await workspaceWithOwner()
    await owner.client.workspaces.create({ name: 'Other', slug: 'other' })
    await owner.client.teams.create({ workspaceSlug: 'tip', name: 'One', key: 'TIP' })
    await expect(
      owner.client.teams.create({ workspaceSlug: 'other', name: 'One', key: 'TIP' }),
    ).resolves.toBeTruthy()
  })

  it('finds teams by key case-insensitively and 404s unknown keys', async () => {
    const { owner } = await workspaceWithOwner()
    await owner.client.teams.create({ workspaceSlug: 'tip', name: 'One', key: 'TIP' })
    await expect(
      owner.client.teams.get({ workspaceSlug: 'tip', key: 'tip' }),
    ).resolves.toMatchObject({ key: 'TIP' })
    await expect(
      owner.client.teams.get({ workspaceSlug: 'tip', key: 'NOPE' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('rejects unauthenticated and cross-workspace creation', async () => {
    await workspaceWithOwner()
    const stranger = await signUp(app, 'Stranger')
    await expect(
      rpcClient(app).teams.create({ workspaceSlug: 'tip', name: 'X', key: 'XX' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    await expect(
      stranger.client.teams.create({ workspaceSlug: 'tip', name: 'X', key: 'XX' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
