import { workflowStatuses } from '@linear/db'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }

async function arrange() {
  const owner = await signUp(app, 'Owner')
  await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ ...scope, name: 'Tip', key: 'TIP' })
  const project = await owner.client.projects.create({ ...scope, name: 'Launch' })
  const [done] = await db
    .select({ id: workflowStatuses.id })
    .from(workflowStatuses)
    .where(and(eq(workflowStatuses.teamId, team.id), eq(workflowStatuses.category, 'completed')))
  const issue = (title: string, extra: { milestoneId?: string; statusId?: string } = {}) =>
    owner.client.issues.create({
      ...scope,
      teamId: team.id,
      title,
      projectId: project.id,
      ...extra,
    })
  return { owner, team, project, doneStatusId: done!.id, issue }
}

/** A second workspace with its own project and milestone. */
async function outsiderWorkspace() {
  const outsider = await signUp(app, 'Outsider')
  await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
  const project = await outsider.client.projects.create({ workspaceSlug: 'other', name: 'Theirs' })
  const milestone = await outsider.client.milestones.create({
    workspaceSlug: 'other',
    projectId: project.id,
    name: 'Beta',
  })
  return { outsider, project, milestone }
}

describe('milestones', () => {
  it('creates, lists in order, updates, reorders and deletes milestones', async () => {
    const { owner, project } = await arrange()
    const api = owner.client.milestones
    const alpha = await api.create({ ...scope, projectId: project.id, name: '  Alpha  ' })
    const beta = await api.create({
      ...scope,
      projectId: project.id,
      name: 'Beta',
      description: 'Public beta',
      targetDate: '2026-12-01',
    })
    expect(alpha).toMatchObject({ name: 'Alpha', sortOrder: 0, issueCount: 0, progress: 0 })
    expect(beta).toMatchObject({
      sortOrder: 1,
      targetDate: '2026-12-01',
      description: 'Public beta',
    })

    const gamma = await api.create({ ...scope, projectId: project.id, name: 'Gamma' })
    const ids = async () => (await api.list({ ...scope, projectId: project.id })).map((m) => m.id)
    expect(await ids()).toEqual([alpha.id, beta.id, gamma.id])

    expect(
      (
        await api.reorder({ ...scope, projectId: project.id, orderedIds: [gamma.id, alpha.id] })
      ).map((m) => m.id),
    ).toEqual([gamma.id, alpha.id, beta.id])
    expect(await ids()).toEqual([gamma.id, alpha.id, beta.id])
    await expect(
      api.reorder({ ...scope, projectId: project.id, orderedIds: [crypto.randomUUID()] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(
      await api.update({
        ...scope,
        id: beta.id,
        name: 'Beta 2',
        targetDate: null,
        description: null,
      }),
    ).toMatchObject({ name: 'Beta 2', targetDate: null, description: null })

    await expect(api.delete({ ...scope, id: gamma.id })).resolves.toEqual({ id: gamma.id })
    expect(await ids()).toEqual([alpha.id, beta.id])
    await expect(api.delete({ ...scope, id: gamma.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('rejects a duplicate name in the same project with CONFLICT', async () => {
    const { owner, project } = await arrange()
    const api = owner.client.milestones
    await api.create({ ...scope, projectId: project.id, name: 'Alpha' })
    const beta = await api.create({ ...scope, projectId: project.id, name: 'Beta' })
    await expect(
      api.create({ ...scope, projectId: project.id, name: 'Alpha' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(api.update({ ...scope, id: beta.id, name: 'Alpha' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    // Another project may reuse the name.
    const other = await owner.client.projects.create({ ...scope, name: 'Other' })
    await expect(api.create({ ...scope, projectId: other.id, name: 'Alpha' })).resolves.toBeTruthy()
  })

  it('counts issues per milestone and shows the current milestone on the project', async () => {
    const { owner, project, doneStatusId, issue } = await arrange()
    const api = owner.client.milestones
    const alpha = await api.create({ ...scope, projectId: project.id, name: 'Alpha' })
    const beta = await api.create({ ...scope, projectId: project.id, name: 'Beta' })
    await issue('A1', { milestoneId: alpha.id, statusId: doneStatusId })
    await issue('B1', { milestoneId: beta.id, statusId: doneStatusId })
    const open = await issue('B2', { milestoneId: beta.id })
    await issue('No milestone')

    expect(await api.list({ ...scope, projectId: project.id })).toMatchObject([
      { id: alpha.id, issueCount: 1, doneCount: 1, progress: 1, isComplete: true },
      { id: beta.id, issueCount: 2, doneCount: 1, progress: 0.5, isComplete: false },
    ])
    const current = { id: beta.id, name: 'Beta', progress: 0.5 }
    expect(await owner.client.projects.get({ ...scope, id: project.id })).toMatchObject({
      currentMilestone: current,
    })
    expect(await owner.client.projects.list(scope)).toMatchObject([{ currentMilestone: current }])

    // Filters: a milestone, or no milestone.
    const titles = async (milestoneIds: (string | null)[]) =>
      (await owner.client.issues.list({ ...scope, milestoneIds })).items.map((i) => i.title).sort()
    expect(await titles([beta.id])).toEqual(['B1', 'B2'])
    expect(await titles([null])).toEqual(['No milestone'])

    // Deleting a milestone keeps its issues in the project.
    await api.delete({ ...scope, id: beta.id })
    expect(await owner.client.issues.get({ ...scope, id: open.id })).toMatchObject({
      projectId: project.id,
      milestoneId: null,
    })
    expect(await owner.client.projects.get({ ...scope, id: project.id })).toMatchObject({
      currentMilestone: null,
    })
  })

  it("keeps an issue's milestone inside its project", async () => {
    const { owner, project, issue } = await arrange()
    const alpha = await owner.client.milestones.create({
      ...scope,
      projectId: project.id,
      name: 'Alpha',
    })
    const other = await owner.client.projects.create({ ...scope, name: 'Other' })
    const elsewhere = await owner.client.milestones.create({
      ...scope,
      projectId: other.id,
      name: 'Elsewhere',
    })

    await expect(issue('Mismatch', { milestoneId: elsewhere.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    const created = await issue('Ok', { milestoneId: alpha.id })
    expect(created.milestoneId).toBe(alpha.id)
    await expect(
      owner.client.issues.update({ ...scope, id: created.id, milestoneId: elsewhere.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    // Changing the project clears the milestone; so does clearing it.
    const moved = await owner.client.issues.update({
      ...scope,
      id: created.id,
      projectId: other.id,
    })
    expect(moved).toMatchObject({ projectId: other.id, milestoneId: null })
    // Both at once: the milestone is checked against the new project.
    const both = await owner.client.issues.update({
      ...scope,
      id: created.id,
      projectId: project.id,
      milestoneId: alpha.id,
    })
    expect(both.milestoneId).toBe(alpha.id)
    const cleared = await owner.client.issues.update({ ...scope, id: created.id, projectId: null })
    expect(cleared).toMatchObject({ projectId: null, milestoneId: null })
    await expect(
      owner.client.issues.update({ ...scope, id: created.id, milestoneId: alpha.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('clears milestones when a bulk update moves issues to another project', async () => {
    const { owner, project, issue } = await arrange()
    const alpha = await owner.client.milestones.create({
      ...scope,
      projectId: project.id,
      name: 'Alpha',
    })
    const other = await owner.client.projects.create({ ...scope, name: 'Other' })
    const ids = [
      (await issue('One', { milestoneId: alpha.id })).id,
      (await issue('Two', { milestoneId: alpha.id })).id,
    ]
    const moved = await owner.client.issues.bulkUpdate({
      ...scope,
      ids,
      patch: { projectId: other.id },
    })
    expect(moved.items.map((i) => [i.projectId, i.milestoneId])).toEqual([
      [other.id, null],
      [other.id, null],
    ])
  })

  it('hides projects and milestones of other workspaces (NOT_FOUND)', async () => {
    const { owner, project, issue } = await arrange()
    const theirs = await outsiderWorkspace()
    const api = owner.client.milestones

    await expect(api.list({ ...scope, projectId: theirs.project.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      api.create({ ...scope, projectId: theirs.project.id, name: 'Sneaky' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      api.update({ ...scope, id: theirs.milestone.id, name: 'Renamed' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(api.delete({ ...scope, id: theirs.milestone.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      api.reorder({ ...scope, projectId: project.id, orderedIds: [theirs.milestone.id] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      api.reorder({ ...scope, projectId: theirs.project.id, orderedIds: [theirs.milestone.id] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Through the other workspace's slug, without membership.
    await expect(
      api.list({ workspaceSlug: 'other', projectId: theirs.project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Their milestone can't be put on our issue.
    await expect(issue('Cross', { milestoneId: theirs.milestone.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    expect(
      (
        await theirs.outsider.client.milestones.list({
          workspaceSlug: 'other',
          projectId: theirs.project.id,
        })
      ).map((m) => m.name),
    ).toEqual(['Beta'])
    await expect(
      rpcClient(app).milestones.list({ ...scope, projectId: project.id }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
