import type { ViewDisplay } from '@linear/contract'
import { addMember } from '@linear/db/testing'
import { views } from '@linear/db'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

const scope = { workspaceSlug: 'tip' }
const display: ViewDisplay = {
  layout: 'board',
  grouping: 'assignee',
  groupDirection: 'asc',
  subGrouping: 'none',
  ordering: 'priority',
  orderDirection: 'desc',
  orderCompletedByRecency: false,
  completedIssues: 'week',
  showSubIssues: true,
  showEmptyGroups: false,
  properties: ['id', 'status', 'priority'],
}

async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ ...scope, name: 'Tip', key: 'TIP' })
  const ops = await owner.client.teams.create({ ...scope, name: 'Ops', key: 'OPS' })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  const other = await signUp(app, 'Other')
  await addMember(db, workspace.id, other.userId)
  const bug = await owner.client.labels.create({ ...scope, name: 'Bug', color: '#eb5757' })
  const todo = team.statuses.find((s) => s.name === 'Todo')!
  return { owner, member, other, workspace, team, ops, bug, todo }
}

async function foreignWorkspace() {
  const stranger = await signUp(app, 'Stranger')
  await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
  const team = await stranger.client.teams.create({ workspaceSlug: 'mine', name: 'M', key: 'MIN' })
  const label = await stranger.client.labels.create({
    workspaceSlug: 'mine',
    name: 'X',
    color: '#000000',
  })
  const project = await stranger.client.projects.create({ workspaceSlug: 'mine', name: 'P' })
  const milestone = await stranger.client.milestones.create({
    workspaceSlug: 'mine',
    projectId: project.id,
    name: 'Beta',
  })
  const view = await stranger.client.views.create({
    workspaceSlug: 'mine',
    name: 'Theirs',
    filters: {},
    display,
  })
  return { stranger, team, label, project, milestone, view, status: team.statuses[0]! }
}

describe('views', () => {
  it('lets a member create, get, update and delete a view', async () => {
    const { member, bug, todo } = await arrange()
    const view = await member.client.views.create({
      ...scope,
      name: ' Bugs ',
      icon: 'bug',
      color: 'urgent',
      filters: { labelIds: [bug.id], statusIds: [todo.id], priorities: [1], assigneeIds: [null] },
      display,
    })
    expect(view).toMatchObject({
      name: 'Bugs',
      icon: 'bug',
      color: 'urgent',
      scope: 'workspace',
      teamId: null,
      shared: true,
      owner: { id: member.userId, name: 'Member' },
      filters: { labelIds: [bug.id], statusIds: [todo.id], priorities: [1], assigneeIds: [null] },
      display,
    })
    expect(await member.client.views.get({ ...scope, id: view.id })).toEqual(view)

    const updated = await member.client.views.update({
      ...scope,
      id: view.id,
      name: 'Urgent bugs',
      filters: { priorities: [1, 2] },
    })
    expect(updated).toMatchObject({ name: 'Urgent bugs', filters: { priorities: [1, 2] }, display })
    expect(updated.filters).not.toHaveProperty('labelIds')

    expect(await member.client.views.delete({ ...scope, id: view.id })).toEqual({ id: view.id })
    await expect(member.client.views.get({ ...scope, id: view.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('lists team views only for that team, and every view without a team', async () => {
    const { owner, team, ops } = await arrange()
    const create = (name: string, teamId?: string) =>
      owner.client.views.create({ ...scope, name, teamId, filters: {}, display })
    const all = await create('All')
    const tip = await create('Tip only', team.id)
    const opsView = await create('Ops only', ops.id)

    const ids = async (teamId?: string) =>
      (await owner.client.views.list({ ...scope, teamId })).map((v) => v.id)
    expect(await ids()).toEqual([all.id, opsView.id, tip.id])
    expect(await ids(team.id)).toEqual([tip.id])
    expect(tip.scope).toBe('team')
  })

  it('hides private views from everyone but their owner', async () => {
    const { owner, member } = await arrange()
    const mine = await member.client.views.create({
      ...scope,
      name: 'Mine',
      shared: false,
      filters: {},
      display,
    })
    expect((await member.client.views.list(scope)).map((v) => v.id)).toEqual([mine.id])
    expect(await owner.client.views.list(scope)).toEqual([])
    // Not even a workspace owner can open, edit, delete or favorite it.
    for (const call of [
      () => owner.client.views.get({ ...scope, id: mine.id }),
      () => owner.client.views.update({ ...scope, id: mine.id, name: 'Taken' }),
      () => owner.client.views.delete({ ...scope, id: mine.id }),
      () => owner.client.favorites.add({ ...scope, entityType: 'view', entityId: mine.id }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
  })

  it('lets only the owner or a workspace owner change a shared view', async () => {
    const { owner, member, other } = await arrange()
    const view = await member.client.views.create({ ...scope, name: 'Team', filters: {}, display })

    await expect(
      other.client.views.update({ ...scope, id: view.id, name: 'Mine now' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(other.client.views.delete({ ...scope, id: view.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    const renamed = await owner.client.views.update({ ...scope, id: view.id, name: 'Renamed' })
    expect(renamed).toMatchObject({ name: 'Renamed', owner: { id: member.userId } })
    expect(await owner.client.views.delete({ ...scope, id: view.id })).toEqual({ id: view.id })
  })

  it('rejects teams and filter ids from another workspace with NOT_FOUND', async () => {
    const { member } = await arrange()
    const foreign = await foreignWorkspace()
    const base = { ...scope, name: 'Probe', display }
    for (const input of [
      { ...base, teamId: foreign.team.id, filters: {} },
      { ...base, filters: { labelIds: [foreign.label.id] } },
      { ...base, filters: { statusIds: [foreign.status.id] } },
      { ...base, filters: { projectIds: [foreign.project.id] } },
      { ...base, filters: { milestoneIds: [foreign.milestone.id] } },
      { ...base, filters: { assigneeIds: [foreign.stranger.userId] } },
      { ...base, filters: { subscriberIds: [foreign.stranger.userId] } },
    ]) {
      await expect(member.client.views.create(input)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    const view = await member.client.views.create({ ...base, filters: {} })
    await expect(
      member.client.views.update({
        ...scope,
        id: view.id,
        filters: { labelIds: [foreign.label.id] },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns NOT_FOUND for another workspace’s view, even through our slug', async () => {
    const { owner } = await arrange()
    const { view, stranger } = await foreignWorkspace()
    for (const call of [
      () => owner.client.views.get({ ...scope, id: view.id }),
      () => owner.client.views.update({ ...scope, id: view.id, name: 'x' }),
      () => owner.client.views.delete({ ...scope, id: view.id }),
      () => owner.client.views.list({ workspaceSlug: 'mine' }),
      () => owner.client.views.get({ workspaceSlug: 'mine', id: view.id }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    expect(await stranger.client.views.get({ workspaceSlug: 'mine', id: view.id })).toMatchObject({
      name: 'Theirs',
    })
  })

  it('rejects invalid filter JSON and requires a session', async () => {
    const { member } = await arrange()
    await expect(
      member.client.views.create({
        ...scope,
        name: 'Bad',
        // @ts-expect-error — not a filter the contract knows
        filters: { colour: 'red' },
        display,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(rpcClient(app).views.list(scope)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('drops stale stored fields on read instead of failing', async () => {
    const { member, bug } = await arrange()
    const view = await member.client.views.create({
      ...scope,
      name: 'Old',
      filters: { labelIds: [bug.id] },
      display,
    })
    await db
      .update(views)
      .set({
        icon: 'unicorn',
        filters: { labelIds: [bug.id], priorities: ['high'], gone: true },
        display: { layout: 'gallery', grouping: 'priority' },
      })
      .where(eq(views.id, view.id))
    const read = await member.client.views.get({ ...scope, id: view.id })
    expect(read.icon).toBe('layers')
    expect(read.filters.labelIds).toEqual([bug.id])
    expect(read.filters).not.toHaveProperty('priorities')
    expect(read.display).toEqual({ grouping: 'priority' })
  })

  it('can be favorited, and deleting it removes the favorite', async () => {
    const { owner, member } = await arrange()
    const view = await member.client.views.create({
      ...scope,
      name: 'Board',
      icon: 'star',
      color: 'success',
      filters: {},
      display,
    })
    await owner.client.favorites.add({ ...scope, entityType: 'view', entityId: view.id })
    expect(await owner.client.favorites.list(scope)).toMatchObject([
      { entityType: 'view', entityId: view.id, name: 'Board', icon: 'star', color: 'success' },
    ])
    await member.client.views.delete({ ...scope, id: view.id })
    expect(await owner.client.favorites.list(scope)).toEqual([])
  })
})
