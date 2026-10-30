import { uploads, workflowStatuses } from '@linear/db'
import { addMember, createTeam } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db } = await setupTestApp()
async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await createTeam(db, { workspaceId: workspace.id, key: 'TIP' })
  return { owner, workspace, team }
}
describe('projects', () => {
  it('supports member CRUD, team replacement, category progress and clearing deleted projects', async () => {
    const { workspace, team } = await arrange()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const { projects, issues } = member.client
    const scope = { workspaceSlug: 'tip' }
    const project = await projects.create({
      ...scope,
      name: ' Launch ',
      teamIds: [team.id, team.id],
    })
    expect(project).toMatchObject({ name: 'Launch', status: 'planned', teamIds: [team.id] })
    expect((await projects.get({ ...scope, id: project.id })).progress).toEqual({
      completed: 0,
      total: 0,
    })
    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.teamId, team.id))
    const done = statuses.find((s) => s.category === 'completed')!
    await db
      .update(workflowStatuses)
      .set({ name: 'Shipped' })
      .where(eq(workflowStatuses.id, done.id))
    const issue = await issues.create({
      ...scope,
      teamId: team.id,
      title: 'Done',
      projectId: project.id,
      statusId: done.id,
    })
    await issues.create({
      ...scope,
      teamId: team.id,
      title: 'Canceled',
      projectId: project.id,
      statusId: statuses.find((s) => s.category === 'canceled')!.id,
    })
    expect((await projects.get({ ...scope, id: project.id })).progress).toEqual({
      completed: 1,
      total: 2,
    })
    expect(
      await projects.update({
        ...scope,
        id: project.id,
        description: 'Description',
        status: 'in_progress',
        teamIds: [],
      }),
    ).toMatchObject({ name: 'Launch', description: 'Description', teamIds: [] })
    expect(await projects.list(scope)).toHaveLength(1)
    await projects.delete({ ...scope, id: project.id })
    expect(await projects.list(scope)).toEqual([])
    expect(await issues.get({ ...scope, id: issue.id })).toMatchObject({ projectId: null })
  })

  it('isolates projects, issue assignments, teams and icons across workspaces', async () => {
    const { owner, workspace, team } = await arrange()
    const stranger = await signUp(app, 'Stranger')
    const { workspace: other } = await stranger.client.workspaces.create({
      name: 'Other',
      slug: 'other',
    })
    const foreignTeam = await createTeam(db, { workspaceId: other.id, key: 'OTHER' })
    const project = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'Launch' })
    const foreign = await stranger.client.projects.create({
      workspaceSlug: 'other',
      name: 'Foreign',
    })
    for (const client of [stranger.client, rpcClient(app)]) {
      const code = client === stranger.client ? 'NOT_FOUND' : 'UNAUTHORIZED'
      await expect(client.projects.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({ code })
      await expect(
        client.projects.get({ workspaceSlug: 'tip', id: project.id }),
      ).rejects.toMatchObject({ code })
      await expect(
        client.projects.create({ workspaceSlug: 'tip', name: 'X' }),
      ).rejects.toMatchObject({ code })
      await expect(
        client.projects.update({ workspaceSlug: 'tip', id: project.id, name: 'X' }),
      ).rejects.toMatchObject({ code })
      await expect(
        client.projects.delete({ workspaceSlug: 'tip', id: project.id }),
      ).rejects.toMatchObject({ code })
    }
    await expect(
      owner.client.projects.get({ workspaceSlug: 'tip', id: foreign.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      owner.client.projects.update({ workspaceSlug: 'tip', id: foreign.id, name: 'X' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      owner.client.projects.delete({ workspaceSlug: 'tip', id: foreign.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      owner.client.projects.update({
        workspaceSlug: 'tip',
        id: project.id,
        teamIds: [foreignTeam.id],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const input = { workspaceSlug: 'tip', teamId: team.id, title: 'Issue' }
    await expect(
      owner.client.issues.create({ ...input, projectId: foreign.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const issue = await owner.client.issues.create(input)
    await expect(
      owner.client.issues.update({ workspaceSlug: 'tip', id: issue.id, projectId: foreign.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const [icon] = await db
      .insert(uploads)
      .values({
        workspaceId: workspace.id,
        uploadedById: owner.userId,
        kind: 'project_icon',
        objectKey: 'project-icon',
        contentType: 'image/png',
        size: 100,
      })
      .returning()
    await expect(
      owner.client.projects.update({
        workspaceSlug: 'tip',
        id: project.id,
        iconUploadId: icon!.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await db.update(uploads).set({ status: 'ready' }).where(eq(uploads.id, icon!.id))
    expect(
      await owner.client.projects.update({
        workspaceSlug: 'tip',
        id: project.id,
        iconUploadId: icon!.id,
      }),
    ).toMatchObject({ iconUploadId: icon!.id })
    await expect(
      stranger.client.projects.update({
        workspaceSlug: 'other',
        id: foreign.id,
        iconUploadId: icon!.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(
      await owner.client.projects.update({
        workspaceSlug: 'tip',
        id: project.id,
        iconUploadId: null,
      }),
    ).toMatchObject({ iconUploadId: null })
  })
})
