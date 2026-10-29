import { workflowStatuses } from '@linear/db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

describe('workspaces.create', () => {
  it('creates a workspace with its first team and default statuses', async () => {
    const { client } = await signUp(app)
    const result = await client.workspaces.create({
      name: 'Tip',
      slug: 'tip',
      team: { name: 'Tip Development', key: 'tip' },
    })
    expect(result.workspace).toMatchObject({ name: 'Tip', slug: 'tip', role: 'owner' })
    expect(result.team).toMatchObject({ name: 'Tip Development', key: 'TIP' })

    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.teamId, result.team!.id))
    expect(
      statuses.sort((a, b) => a.position - b.position).map((s) => [s.name, s.category]),
    ).toEqual([
      ['Backlog', 'backlog'],
      ['Todo', 'unstarted'],
      ['In Progress', 'started'],
      ['Done', 'completed'],
      ['Canceled', 'canceled'],
    ])
  })

  it('rejects a taken slug with CONFLICT', async () => {
    const a = await signUp(app, 'A')
    const b = await signUp(app, 'B')
    await a.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    await expect(b.client.workspaces.create({ name: 'Other', slug: 'tip' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('rejects invalid slugs and team keys', async () => {
    const { client } = await signUp(app)
    await expect(client.workspaces.create({ name: 'X', slug: '-bad-' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    await expect(
      client.workspaces.create({ name: 'X', slug: 'good', team: { name: 'T', key: '1A' } }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('requires authentication', async () => {
    await expect(rpcClient(app).workspaces.create({ name: 'X', slug: 'xx' })).rejects.toMatchObject(
      {
        code: 'UNAUTHORIZED',
      },
    )
  })
})

describe('workspace isolation', () => {
  it('lets a user belong to several workspaces and lists only theirs', async () => {
    const a = await signUp(app, 'A')
    const b = await signUp(app, 'B')
    await a.client.workspaces.create({ name: 'Alpha', slug: 'alpha' })
    await a.client.workspaces.create({ name: 'Beta', slug: 'beta' })
    await b.client.workspaces.create({ name: 'Gamma', slug: 'gamma' })

    expect((await a.client.me.listWorkspaces()).map((w) => w.slug)).toEqual(['alpha', 'beta'])
    expect((await b.client.me.listWorkspaces()).map((w) => w.slug)).toEqual(['gamma'])
  })

  it('returns NOT_FOUND for workspaces the user is not a member of', async () => {
    const owner = await signUp(app, 'Owner')
    const stranger = await signUp(app, 'Stranger')
    await owner.client.workspaces.create({
      name: 'Private',
      slug: 'private',
      team: { name: 'T', key: 'PRV' },
    })

    await expect(
      stranger.client.workspaces.get({ workspaceSlug: 'private' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      stranger.client.workspaces.listMembers({ workspaceSlug: 'private' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(stranger.client.teams.list({ workspaceSlug: 'private' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      stranger.client.teams.get({ workspaceSlug: 'private', key: 'PRV' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('lists members with roles', async () => {
    const { client, email } = await signUp(app, 'Owner')
    await client.workspaces.create({ name: 'Tip', slug: 'tip' })
    const members = await client.workspaces.listMembers({ workspaceSlug: 'tip' })
    expect(members).toEqual([expect.objectContaining({ email, role: 'owner', avatarUrl: null })])
  })
})
