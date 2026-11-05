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

describe('workspace invites', () => {
  async function ownerWithWorkspace() {
    const owner = await signUp(app, 'Owner')
    await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
    return owner
  }

  it('has no code until the owner creates one', async () => {
    const owner = await ownerWithWorkspace()
    expect(await owner.client.workspaces.getInvite({ workspaceSlug: 'tip' })).toEqual({
      code: null,
    })
    const { code } = await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })
    expect(code).toMatch(/^[A-Z2-9]{10}$/)
    expect(await owner.client.workspaces.getInvite({ workspaceSlug: 'tip' })).toEqual({ code })
  })

  it('lets anyone with the code join as a member, ignoring case and dashes', async () => {
    const owner = await ownerWithWorkspace()
    const { code } = await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })
    const tester = await signUp(app, 'Tester')

    const typed = `${code!.slice(0, 5)}-${code!.slice(5)}`.toLowerCase()
    expect(await tester.client.workspaces.join({ code: typed })).toMatchObject({
      slug: 'tip',
      role: 'member',
    })
    expect((await tester.client.me.listWorkspaces()).map((w) => w.slug)).toEqual(['tip'])
    const members = await owner.client.workspaces.listMembers({ workspaceSlug: 'tip' })
    expect(members.map((m) => [m.email, m.role]).sort()).toEqual(
      [
        [owner.email, 'owner'],
        [tester.email, 'member'],
      ].sort(),
    )
  })

  it('keeps the role of someone who is already a member', async () => {
    const owner = await ownerWithWorkspace()
    const { code } = await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })
    expect(await owner.client.workspaces.join({ code: code! })).toMatchObject({ role: 'owner' })
    expect(await owner.client.workspaces.listMembers({ workspaceSlug: 'tip' })).toHaveLength(1)
  })

  it('rejects unknown, reset and turned-off codes with NOT_FOUND', async () => {
    const owner = await ownerWithWorkspace()
    const tester = await signUp(app, 'Tester')
    await expect(tester.client.workspaces.join({ code: 'ABCDEFGHJK' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })

    const first = await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })
    const second = await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })
    expect(second.code).not.toBe(first.code)
    await expect(tester.client.workspaces.join({ code: first.code! })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })

    await owner.client.workspaces.disableInvite({ workspaceSlug: 'tip' })
    await expect(tester.client.workspaces.join({ code: second.code! })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(await tester.client.me.listWorkspaces()).toEqual([])
  })

  it('lets only owners manage the code', async () => {
    const owner = await ownerWithWorkspace()
    const { code } = await owner.client.workspaces.resetInvite({ workspaceSlug: 'tip' })
    const member = await signUp(app, 'Member')
    await member.client.workspaces.join({ code: code! })
    const stranger = await signUp(app, 'Stranger')

    for (const call of ['getInvite', 'resetInvite', 'disableInvite'] as const) {
      await expect(member.client.workspaces[call]({ workspaceSlug: 'tip' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
      await expect(
        stranger.client.workspaces[call]({ workspaceSlug: 'tip' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    expect(await owner.client.workspaces.getInvite({ workspaceSlug: 'tip' })).toEqual({ code })
  })

  it('requires authentication to join', async () => {
    await expect(rpcClient(app).workspaces.join({ code: 'ABCDEFGHJK' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})
