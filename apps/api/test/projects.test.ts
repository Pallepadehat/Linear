import { uploads, workflowStatuses } from '@linear/db'
import { addMember, createTeam } from '@linear/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db, objects } = await setupTestApp()
async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await createTeam(db, { workspaceId: workspace.id, key: 'TIP' })
  return { owner, workspace, team }
}
describe('projects', () => {
  it('uploads and confirms a project icon through the existing upload flow', async () => {
    const { owner, workspace } = await arrange()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const input = {
      workspaceSlug: 'tip',
      kind: 'project_icon' as const,
      contentType: 'image/webp',
      size: 100,
    }
    for (const invalid of [
      { ...input, size: 1024 * 1024 + 1 },
      { ...input, contentType: 'image/svg+xml' },
    ]) {
      await expect(member.client.uploads.createPresignedUpload(invalid)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      })
    }
    const presigned = await member.client.uploads.createPresignedUpload(input)
    const [row] = await db.select().from(uploads).where(eq(uploads.id, presigned.uploadId))
    objects.set(row!.objectKey, {
      body: new Uint8Array(input.size),
      contentType: input.contentType,
    })
    await member.client.uploads.confirm({ uploadId: presigned.uploadId })
    expect(
      await member.client.projects.create({
        workspaceSlug: 'tip',
        name: 'Icon',
        iconUploadId: presigned.uploadId,
      }),
    ).toMatchObject({ iconUploadId: presigned.uploadId, iconUrl: expect.any(String) })
    expect(await owner.client.projects.list({ workspaceSlug: 'tip' })).toMatchObject([
      { iconUrl: expect.any(String) },
    ])
  })

  it('serializes concurrent team-set replacements', async () => {
    const { owner, workspace, team } = await arrange()
    const second = await createTeam(db, { workspaceId: workspace.id, key: 'SECOND' })
    const scope = { workspaceSlug: 'tip' }
    const project = await owner.client.projects.create({ ...scope, name: 'Concurrent' })
    await Promise.all(
      [team.id, second.id].map((teamId) =>
        owner.client.projects.update({ ...scope, id: project.id, teamIds: [teamId] }),
      ),
    )
    const result = await owner.client.projects.get({ ...scope, id: project.id })
    expect(result.teamIds).toHaveLength(1)
    expect([team.id, second.id]).toContain(result.teamIds[0])
  })

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
    // The list carries the same progress, and unlinked issues don't count.
    const other = await projects.create({ ...scope, name: 'Other' })
    await issues.create({ ...scope, teamId: team.id, title: 'Unlinked' })
    expect(await projects.list(scope)).toMatchObject([
      { id: project.id, progress: { completed: 1, total: 2 } },
      { id: other.id, progress: { completed: 0, total: 0 } },
    ])
    // The project page lists only that project's issues.
    const page = await issues.list({ ...scope, projectId: project.id })
    expect(page.items.map((i) => i.title).sort()).toEqual(['Canceled', 'Done'])
    await projects.delete({ ...scope, id: other.id })
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

  it('creates and updates every project property', async () => {
    const { owner, workspace } = await arrange()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const scope = { workspaceSlug: 'tip' }
    const bug = await member.client.projectLabels.create({
      ...scope,
      name: ' Bet ',
      color: '#AABBCC',
    })
    expect(bug).toMatchObject({ name: 'Bet', color: '#aabbcc' })
    const infra = await member.client.projectLabels.create({
      ...scope,
      name: 'Infra',
      color: '#5e6ad2',
    })
    await expect(
      member.client.projectLabels.create({ ...scope, name: 'Bet', color: '#000000' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await owner.client.projectLabels.list(scope)).toEqual([bug, infra])
    // Issue labels are a separate set.
    expect(await owner.client.labels.list(scope)).toEqual([])

    const project = await member.client.projects.create({
      ...scope,
      name: 'Launch',
      priority: 2,
      leadId: owner.userId,
      memberIds: [owner.userId, member.userId, owner.userId],
      startDate: '2026-11-03',
      targetDate: '2026-12-31',
      labelIds: [bug.id],
    })
    expect(project).toMatchObject({
      priority: 2,
      leadId: owner.userId,
      memberIds: [owner.userId, member.userId],
      startDate: '2026-11-03',
      targetDate: '2026-12-31',
      labelIds: [bug.id],
      issueCount: 0,
    })
    const defaults = await member.client.projects.create({ ...scope, name: 'Defaults' })
    expect(defaults).toMatchObject({
      priority: 0,
      leadId: null,
      memberIds: [],
      startDate: null,
      targetDate: null,
      labelIds: [],
    })

    // Omitted fields stay; supplied sets are replaced.
    const updated = await owner.client.projects.update({
      ...scope,
      id: project.id,
      priority: 4,
      leadId: member.userId,
      memberIds: [member.userId],
      targetDate: '2027-01-15',
      labelIds: [infra.id, bug.id],
    })
    expect(updated).toMatchObject({
      priority: 4,
      leadId: member.userId,
      memberIds: [member.userId],
      startDate: '2026-11-03',
      targetDate: '2027-01-15',
      teamIds: [],
    })
    expect([...updated.labelIds].sort()).toEqual([bug.id, infra.id].sort())
    expect(
      await owner.client.projects.update({
        ...scope,
        id: project.id,
        leadId: null,
        memberIds: [],
        startDate: null,
        targetDate: null,
        labelIds: [],
      }),
    ).toMatchObject({
      leadId: null,
      memberIds: [],
      startDate: null,
      targetDate: null,
      labelIds: [],
    })

    // Priority range and date ordering, including against the stored date.
    for (const priority of [-1, 5]) {
      await expect(
        owner.client.projects.update({ ...scope, id: project.id, priority }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
    await expect(
      owner.client.projects.create({
        ...scope,
        name: 'Backwards',
        startDate: '2026-12-01',
        targetDate: '2026-11-01',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await owner.client.projects.update({ ...scope, id: project.id, targetDate: '2026-11-10' })
    await expect(
      owner.client.projects.update({ ...scope, id: project.id, startDate: '2026-11-11' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      owner.client.projects.update({ ...scope, id: project.id, startDate: '03/11/2026' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    // The list carries the same properties and the issue count.
    const team = await createTeam(db, { workspaceId: workspace.id, key: 'ISS' })
    await member.client.issues.create({
      ...scope,
      teamId: team.id,
      title: 'A',
      projectId: project.id,
    })
    expect(await owner.client.projects.list(scope)).toMatchObject([
      { id: defaults.id, issueCount: 0 },
      { id: project.id, priority: 4, targetDate: '2026-11-10', issueCount: 1 },
    ])
  })

  it('rejects leads, members and labels from another workspace as NOT_FOUND', async () => {
    const { owner } = await arrange()
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Other', slug: 'other' })
    const foreignLabel = await stranger.client.projectLabels.create({
      workspaceSlug: 'other',
      name: 'Foreign',
      color: '#123456',
    })
    const foreign = await stranger.client.projects.create({ workspaceSlug: 'other', name: 'F' })
    const scope = { workspaceSlug: 'tip' }
    const project = await owner.client.projects.create({ ...scope, name: 'Launch' })
    for (const changes of [
      { leadId: stranger.userId },
      { memberIds: [owner.userId, stranger.userId] },
      { labelIds: [foreignLabel.id] },
    ]) {
      await expect(
        owner.client.projects.update({ ...scope, id: project.id, ...changes }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(
        owner.client.projects.create({ ...scope, name: 'New', ...changes }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    await expect(
      owner.client.projects.update({ ...scope, id: foreign.id, priority: 1 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Nothing was written by the rejected calls.
    expect(await owner.client.projects.list(scope)).toMatchObject([
      { id: project.id, leadId: null, memberIds: [], labelIds: [] },
    ])
    // Project labels are workspace-scoped too.
    expect(await owner.client.projectLabels.list(scope)).toEqual([])
    await expect(stranger.client.projectLabels.list(scope)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(
      stranger.client.projectLabels.create({ ...scope, name: 'X', color: '#123456' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(rpcClient(app).projectLabels.list(scope)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})
