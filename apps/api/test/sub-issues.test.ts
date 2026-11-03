import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app } = await setupTestApp()

async function workspaceWithTeam() {
  const owner = await signUp(app, 'Owner')
  await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const status = (name: string) => team.statuses.find((s) => s.name === name)!
  const issues = owner.client.issues
  const create = (title: string, extra: { parentId?: string; statusId?: string } = {}) =>
    issues.create({ workspaceSlug: 'tip', teamId: team.id, title, ...extra })
  return { owner, team, status, issues, create }
}

const kinds = async (client: Awaited<ReturnType<typeof signUp>>['client'], issueId: string) =>
  (await client.activity.list({ workspaceSlug: 'tip', issueId })).items
    .filter((entry) => entry.kind === 'parent' || entry.kind === 'sub_issue')
    .map(({ kind, from, to }) => ({ kind, from, to }))

describe('sub-issues', () => {
  it('sets and clears a parent, logging activity on both issues', async () => {
    const { owner, issues, create } = await workspaceWithTeam()
    const parent = await create('Parent')
    const child = await create('Child')

    const updated = await issues.update({ workspaceSlug: 'tip', id: child.id, parentId: parent.id })
    expect(updated.parentId).toBe(parent.id)
    expect(await issues.get({ workspaceSlug: 'tip', id: child.id })).toMatchObject({
      parent: { id: parent.id, identifier: 'TIP-1', title: 'Parent' },
    })

    const cleared = await issues.update({ workspaceSlug: 'tip', id: child.id, parentId: null })
    expect(cleared.parentId).toBeNull()
    expect((await issues.get({ workspaceSlug: 'tip', id: parent.id })).children).toEqual([])

    expect(await kinds(owner.client, child.id)).toEqual([
      { kind: 'parent', from: null, to: 'TIP-1' },
      { kind: 'parent', from: 'TIP-1', to: null },
    ])
    expect(await kinds(owner.client, parent.id)).toEqual([
      { kind: 'sub_issue', from: null, to: 'TIP-2' },
      { kind: 'sub_issue', from: 'TIP-2', to: null },
    ])
  })

  it('creates a sub-issue directly', async () => {
    const { owner, create } = await workspaceWithTeam()
    const parent = await create('Parent')
    const child = await create('Child', { parentId: parent.id })
    expect(child.parentId).toBe(parent.id)
    expect(await kinds(owner.client, parent.id)).toEqual([
      { kind: 'sub_issue', from: null, to: 'TIP-2' },
    ])
  })

  it('rejects the issue itself and cycles', async () => {
    const { issues, create } = await workspaceWithTeam()
    const a = await create('A')
    const b = await create('B', { parentId: a.id })
    const c = await create('C', { parentId: b.id })
    const badRequest = { code: 'BAD_REQUEST' }

    await expect(
      issues.update({ workspaceSlug: 'tip', id: a.id, parentId: a.id }),
    ).rejects.toMatchObject(badRequest)
    await expect(
      issues.update({ workspaceSlug: 'tip', id: a.id, parentId: c.id }),
    ).rejects.toMatchObject(badRequest)
    expect((await issues.get({ workspaceSlug: 'tip', id: a.id })).parentId).toBeNull()
  })

  it('returns NOT_FOUND for a parent in another workspace', async () => {
    const { issues, create } = await workspaceWithTeam()
    const child = await create('Child')
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const team = await stranger.client.teams.create({
      workspaceSlug: 'mine',
      name: 'Mine',
      key: 'MIN',
    })
    const foreign = await stranger.client.issues.create({
      workspaceSlug: 'mine',
      teamId: team.id,
      title: 'Theirs',
    })

    await expect(
      issues.update({ workspaceSlug: 'tip', id: child.id, parentId: foreign.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      issues.create({
        workspaceSlug: 'tip',
        teamId: child.teamId,
        title: 'X',
        parentId: foreign.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      rpcClient(app).issues.update({ workspaceSlug: 'tip', id: child.id, parentId: null }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns children with progress that skips canceled sub-issues', async () => {
    const { issues, status, create } = await workspaceWithTeam()
    const parent = await create('Parent')
    await create('Done', { parentId: parent.id, statusId: status('Done').id })
    await create('Todo', { parentId: parent.id, statusId: status('Todo').id })
    await create('Canceled', { parentId: parent.id, statusId: status('Canceled').id })

    const detail = await issues.get({ workspaceSlug: 'tip', id: parent.id })
    expect(detail.subIssueProgress).toEqual({ done: 1, total: 2 })
    expect(detail.children.map((c) => c.title)).toEqual(['Done', 'Todo', 'Canceled'])
    expect(detail.parent).toBeNull()

    const listed = await issues.list({ workspaceSlug: 'tip' })
    expect(listed.items.find((i) => i.id === parent.id)?.subIssueProgress).toEqual({
      done: 1,
      total: 2,
    })
    expect(listed.items).toHaveLength(4)
    const topLevel = await issues.list({ workspaceSlug: 'tip', showSubIssues: false })
    expect(topLevel.items.map((i) => i.id)).toEqual([parent.id])
  })

  it('excludes an issue and its descendants for the parent picker', async () => {
    const { issues, create } = await workspaceWithTeam()
    const a = await create('A')
    const b = await create('B', { parentId: a.id })
    await create('C', { parentId: b.id })
    const other = await create('Other')

    const { items } = await issues.list({ workspaceSlug: 'tip', excludeSubtreeOf: a.id })
    expect(items.map((i) => i.id)).toEqual([other.id])
  })

  it('clears the parent of sub-issues when the parent is deleted', async () => {
    const { issues, create } = await workspaceWithTeam()
    const parent = await create('Parent')
    const child = await create('Child', { parentId: parent.id })

    await issues.delete({ workspaceSlug: 'tip', id: parent.id })
    expect(await issues.get({ workspaceSlug: 'tip', id: child.id })).toMatchObject({
      parentId: null,
      parent: null,
    })
  })
})
