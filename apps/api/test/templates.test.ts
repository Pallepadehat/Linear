import { addMember } from '@linear/db/testing'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()

async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const other = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Ops', key: 'OPS' })
  const member = await signUp(app, 'Member')
  await addMember(db, workspace.id, member.userId)
  const bug = await owner.client.labels.create({
    workspaceSlug: 'tip',
    name: 'Bug',
    color: '#eb5757',
  })
  const project = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'Launch' })
  const todo = team.statuses.find((s) => s.name === 'Todo')!
  return { owner, member, workspace, team, other, bug, project, todo }
}

/** A second workspace with its own team, label, project and member. */
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
  return { stranger, team, label, project, status: team.statuses[0]! }
}

describe('templates', () => {
  it('lets a member create, get, list, update and delete templates', async () => {
    const { owner, member, team, bug, project, todo } = await arrange()
    const templates = member.client.templates

    const created = await templates.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      name: ' Bug report ',
      title: 'Bug: ',
      description: '## Steps',
      statusId: todo.id,
      priority: 2,
      assigneeId: owner.userId,
      projectId: project.id,
      labelIds: [bug.id, bug.id],
    })
    expect(created).toMatchObject({
      teamId: team.id,
      name: 'Bug report',
      title: 'Bug:',
      description: '## Steps',
      statusId: todo.id,
      statusCategory: 'unstarted',
      priority: 2,
      assigneeId: owner.userId,
      projectId: project.id,
      labelIds: [bug.id],
    })
    expect(await templates.get({ workspaceSlug: 'tip', id: created.id })).toEqual(created)

    const blank = await templates.create({ workspaceSlug: 'tip', name: 'Blank' })
    expect(blank).toMatchObject({
      teamId: null,
      title: '',
      description: null,
      statusId: null,
      statusCategory: null,
      priority: null,
      assigneeId: null,
      projectId: null,
      labelIds: [],
    })

    const renamed = await templates.update({
      workspaceSlug: 'tip',
      id: created.id,
      name: 'Bug',
      priority: null,
      labelIds: [],
    })
    expect(renamed).toMatchObject({ name: 'Bug', priority: null, labelIds: [], statusId: todo.id })

    await expect(templates.delete({ workspaceSlug: 'tip', id: created.id })).resolves.toEqual({
      id: created.id,
    })
    await expect(templates.get({ workspaceSlug: 'tip', id: created.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(templates.delete({ workspaceSlug: 'tip', id: created.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('lists workspace templates, plus a team’s when asked', async () => {
    const { owner, team, other } = await arrange()
    const t = owner.client.templates
    const ws = await t.create({ workspaceSlug: 'tip', name: 'Workspace' })
    const tip = await t.create({ workspaceSlug: 'tip', teamId: team.id, name: 'Tip only' })
    const ops = await t.create({ workspaceSlug: 'tip', teamId: other.id, name: 'Ops only' })

    expect((await t.list({ workspaceSlug: 'tip' })).map((x) => x.id)).toEqual([ws.id])
    expect((await t.list({ workspaceSlug: 'tip', teamId: team.id })).map((x) => x.id)).toEqual([
      ws.id,
      tip.id,
    ])
    expect((await t.list({ workspaceSlug: 'tip', teamId: other.id })).map((x) => x.id)).toEqual([
      ws.id,
      ops.id,
    ])
  })

  it('rejects a duplicate name within the same scope', async () => {
    const { owner, team, other } = await arrange()
    const t = owner.client.templates
    await t.create({ workspaceSlug: 'tip', name: 'Bug' })
    await t.create({ workspaceSlug: 'tip', teamId: team.id, name: 'Bug' })
    await expect(t.create({ workspaceSlug: 'tip', name: 'Bug' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    await expect(
      t.create({ workspaceSlug: 'tip', teamId: team.id, name: 'Bug' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    const feature = await t.create({ workspaceSlug: 'tip', teamId: other.id, name: 'Bug' })
    const renamed = await t.create({ workspaceSlug: 'tip', teamId: other.id, name: 'Feature' })
    await expect(
      t.update({ workspaceSlug: 'tip', id: renamed.id, name: feature.name }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('rejects a team template status from another team', async () => {
    const { owner, team, other } = await arrange()
    await expect(
      owner.client.templates.create({
        workspaceSlug: 'tip',
        teamId: team.id,
        name: 'X',
        statusId: other.statuses[0]!.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    // A workspace template may use any of the workspace's statuses.
    await expect(
      owner.client.templates.create({
        workspaceSlug: 'tip',
        name: 'X',
        statusId: other.statuses[0]!.id,
      }),
    ).resolves.toMatchObject({ statusCategory: other.statuses[0]!.category })
  })

  it('returns NOT_FOUND for a team, status, label, assignee or project from another workspace', async () => {
    const { owner } = await arrange()
    const foreign = await foreignWorkspace()
    const create = (fields: Record<string, unknown>) =>
      owner.client.templates.create({ workspaceSlug: 'tip', name: 'X', ...fields })

    for (const fields of [
      { teamId: foreign.team.id },
      { statusId: foreign.status.id },
      { labelIds: [foreign.label.id] },
      { assigneeId: foreign.stranger.userId },
      { projectId: foreign.project.id },
    ]) {
      await expect(create(fields)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    const ok = await create({})
    await expect(
      owner.client.templates.update({
        workspaceSlug: 'tip',
        id: ok.id,
        labelIds: [foreign.label.id],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('hides templates from non-members and other workspaces', async () => {
    const { owner } = await arrange()
    const template = await owner.client.templates.create({ workspaceSlug: 'tip', name: 'Bug' })
    const { stranger } = await foreignWorkspace()

    await expect(rpcClient(app).templates.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    await expect(stranger.client.templates.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    for (const call of [
      () => stranger.client.templates.get({ workspaceSlug: 'mine', id: template.id }),
      () => stranger.client.templates.update({ workspaceSlug: 'mine', id: template.id, name: 'H' }),
      () => stranger.client.templates.delete({ workspaceSlug: 'mine', id: template.id }),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    expect(await owner.client.templates.list({ workspaceSlug: 'tip' })).toHaveLength(1)
  })

  it('drops deleted labels and clears deleted projects on read', async () => {
    const { owner, bug, project } = await arrange()
    const feature = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'Feature',
      color: '#5e6ad2',
    })
    const template = await owner.client.templates.create({
      workspaceSlug: 'tip',
      name: 'Bug',
      projectId: project.id,
      labelIds: [bug.id, feature.id],
    })
    await owner.client.labels.delete({ workspaceSlug: 'tip', id: bug.id })
    await owner.client.projects.delete({ workspaceSlug: 'tip', id: project.id })
    await expect(
      owner.client.templates.get({ workspaceSlug: 'tip', id: template.id }),
    ).resolves.toMatchObject({ labelIds: [feature.id], projectId: null })
  })
})
