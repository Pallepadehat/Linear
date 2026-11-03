import { workspaceMembers } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { and, eq } from 'drizzle-orm'
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

describe('team issue defaults', () => {
  async function ownerWithTeam() {
    const { owner, workspace } = await workspaceWithOwner()
    const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
    const status = (name: string) => team.statuses.find((s) => s.name === name)!
    return { owner, workspace, team, status }
  }

  it('starts with Backlog, no priority and no assignee', async () => {
    const { team, status } = await ownerWithTeam()
    expect(team).toMatchObject({
      defaultStatusId: status('Backlog').id,
      defaultPriority: 0,
      defaultAssigneeId: null,
    })
  })

  it('lets the owner change the defaults, which issues.create then uses', async () => {
    const { owner, team, status } = await ownerWithTeam()
    const updated = await owner.client.teams.update({
      workspaceSlug: 'tip',
      key: 'tip',
      defaultStatusId: status('Todo').id,
      defaultPriority: 2,
      defaultAssigneeId: owner.userId,
    })
    expect(updated).toMatchObject({
      defaultStatusId: status('Todo').id,
      defaultPriority: 2,
      defaultAssigneeId: owner.userId,
    })
    await expect(
      owner.client.teams.get({ workspaceSlug: 'tip', key: 'TIP' }),
    ).resolves.toMatchObject({ defaultStatusId: status('Todo').id })

    const issue = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Uses defaults',
    })
    expect(issue).toMatchObject({ priority: 2, assigneeId: owner.userId })
    expect(issue.status.id).toBe(status('Todo').id)

    // Explicit values still win, and null means unassigned.
    const explicit = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Explicit',
      statusId: status('Backlog').id,
      priority: 0,
      assigneeId: null,
    })
    expect(explicit).toMatchObject({ priority: 0, assigneeId: null })
    expect(explicit.status.id).toBe(status('Backlog').id)
  })

  it("rejects another team's status and a non-member assignee", async () => {
    const { owner } = await ownerWithTeam()
    const other = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Ops', key: 'OPS' })
    await expect(
      owner.client.teams.update({
        workspaceSlug: 'tip',
        key: 'TIP',
        defaultStatusId: other.statuses[0]!.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const stranger = await signUp(app, 'Stranger')
    await expect(
      owner.client.teams.update({
        workspaceSlug: 'tip',
        key: 'TIP',
        defaultAssigneeId: stranger.userId,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('is owner-only and hidden from other workspaces', async () => {
    const { workspace, status } = await ownerWithTeam()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const update = { workspaceSlug: 'tip', key: 'TIP', defaultStatusId: status('Todo').id }

    await expect(member.client.teams.update(update)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const stranger = await signUp(app, 'Stranger')
    await expect(stranger.client.teams.update(update)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(rpcClient(app).teams.update(update)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('skips a default assignee who has left the workspace', async () => {
    const { owner, workspace, team } = await ownerWithTeam()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    await owner.client.teams.update({
      workspaceSlug: 'tip',
      key: 'TIP',
      defaultAssigneeId: member.userId,
    })
    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.userId, member.userId),
        ),
      )

    const issue = await owner.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Nobody',
    })
    expect(issue.assigneeId).toBeNull()
  })

  it('404s an unknown team key', async () => {
    const { owner } = await ownerWithTeam()
    await expect(
      owner.client.teams.update({ workspaceSlug: 'tip', key: 'NOPE', defaultPriority: 1 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
