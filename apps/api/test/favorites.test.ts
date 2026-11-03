import { favorites } from '@linear/db'
import { addMember } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }

async function workspaceWithEntities() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ ...scope, name: 'Tip', key: 'TIP' })
  const issue = await owner.client.issues.create({ ...scope, teamId: team.id, title: 'Fix login' })
  const project = await owner.client.projects.create({ ...scope, name: 'Launch' })
  return { owner, workspace, team, issue, project }
}

describe('favorites', () => {
  it('adds, lists, reorders and removes favorites with their summaries', async () => {
    const { owner, team, issue, project } = await workspaceWithEntities()
    const api = owner.client.favorites

    const fIssue = await api.add({ ...scope, entityType: 'issue', entityId: issue.id })
    const fProject = await api.add({ ...scope, entityType: 'project', entityId: project.id })
    const fTeam = await api.add({ ...scope, entityType: 'team', entityId: team.id })

    expect(await api.list(scope)).toEqual([
      {
        id: fIssue.id,
        entityType: 'issue',
        entityId: issue.id,
        identifier: 'TIP-1',
        title: 'Fix login',
        statusCategory: issue.status.category,
      },
      {
        id: fProject.id,
        entityType: 'project',
        entityId: project.id,
        name: 'Launch',
        iconUrl: null,
      },
      { id: fTeam.id, entityType: 'team', entityId: team.id, name: 'Tip', key: 'TIP' },
    ])

    await api.reorder({ ...scope, ids: [fTeam.id, fIssue.id, fProject.id] })
    expect((await api.list(scope)).map((f) => f.id)).toEqual([fTeam.id, fIssue.id, fProject.id])

    // A partial order keeps the others after it.
    await api.reorder({ ...scope, ids: [fProject.id] })
    expect((await api.list(scope)).map((f) => f.id)).toEqual([fProject.id, fTeam.id, fIssue.id])

    await expect(api.remove({ ...scope, id: fTeam.id })).resolves.toEqual({ id: fTeam.id })
    expect((await api.list(scope)).map((f) => f.id)).toEqual([fProject.id, fIssue.id])
    await expect(api.remove({ ...scope, id: fTeam.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('treats adding the same entity again as a no-op', async () => {
    const { owner, issue } = await workspaceWithEntities()
    const input = { ...scope, entityType: 'issue' as const, entityId: issue.id }
    const first = await owner.client.favorites.add(input)
    const second = await owner.client.favorites.add(input)
    expect(second).toEqual(first)
    expect(await owner.client.favorites.list(scope)).toHaveLength(1)
  })

  it('rejects entities from another workspace and unknown ids', async () => {
    const { owner, team } = await workspaceWithEntities()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
    const otherTeam = await outsider.client.teams.create({
      workspaceSlug: 'other',
      name: 'Other',
      key: 'OTH',
    })
    const otherIssue = await outsider.client.issues.create({
      workspaceSlug: 'other',
      teamId: otherTeam.id,
      title: 'Theirs',
    })

    for (const [entityType, entityId] of [
      ['issue', otherIssue.id],
      ['team', otherTeam.id],
      ['project', team.id],
      ['view', team.id],
    ] as const) {
      await expect(
        owner.client.favorites.add({ ...scope, entityType, entityId }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    // Nor can the outsider favorite our entities through their own workspace.
    await expect(
      outsider.client.favorites.add({
        workspaceSlug: 'other',
        entityType: 'team',
        entityId: team.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(outsider.client.favorites.list(scope)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(rpcClient(app).favorites.list(scope)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it("keeps favorites personal: another member can't see, remove or reorder them", async () => {
    const { owner, workspace, issue } = await workspaceWithEntities()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const mine = await owner.client.favorites.add({
      ...scope,
      entityType: 'issue',
      entityId: issue.id,
    })

    expect(await member.client.favorites.list(scope)).toEqual([])
    await expect(member.client.favorites.remove({ ...scope, id: mine.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      member.client.favorites.reorder({ ...scope, ids: [mine.id] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // The same entity can be a favorite of both users independently.
    const theirs = await member.client.favorites.add({
      ...scope,
      entityType: 'issue',
      entityId: issue.id,
    })
    expect(theirs.id).not.toBe(mine.id)
    expect((await owner.client.favorites.list(scope)).map((f) => f.id)).toEqual([mine.id])
  })

  it('deletes favorites together with their issue or project', async () => {
    const { owner, workspace, issue, project } = await workspaceWithEntities()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    for (const client of [owner.client, member.client]) {
      await client.favorites.add({ ...scope, entityType: 'issue', entityId: issue.id })
      await client.favorites.add({ ...scope, entityType: 'project', entityId: project.id })
    }

    await owner.client.issues.delete({ ...scope, id: issue.id })
    await owner.client.projects.delete({ ...scope, id: project.id })

    expect(await owner.client.favorites.list(scope)).toEqual([])
    expect(await member.client.favorites.list(scope)).toEqual([])
    const rows = await db.select().from(favorites).where(eq(favorites.workspaceId, workspace.id))
    expect(rows).toEqual([])
  })
})
