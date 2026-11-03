import type { ListIssuesInput } from '@linear/contract'
import { createIssue } from '@linear/core'
import { issueAttachments, issues, teams, uploads, workflowStatuses } from '@linear/db'
import {
  addMember,
  createTeam,
  createUser,
  createWorkspace,
  createIssue as insertIssue,
} from '@linear/db/testing'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db, queues, objects } = await setupTestApp()

async function arrange() {
  const user = await createUser(db)
  const workspace = await createWorkspace(db, { ownerId: user.id })
  const team = await createTeam(db, { workspaceId: workspace.id, key: 'TIP' })
  return { user, workspace, team }
}

async function statusNamed(teamId: string, name: string) {
  const [status] = await db
    .select()
    .from(workflowStatuses)
    .where(and(eq(workflowStatuses.teamId, teamId), eq(workflowStatuses.name, name)))
  return status!
}

describe('createIssue', () => {
  it('allocates 1..20 without gaps or duplicates for 20 concurrent creates', async () => {
    const { user, workspace, team } = await arrange()

    const created = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createIssue(db, {
          workspaceId: workspace.id,
          teamId: team.id,
          creatorId: user.id,
          title: `Issue ${i}`,
        }),
      ),
    )

    const numbers = created.map((issue) => issue.number).sort((a, b) => a - b)
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    const [counter] = await db.select().from(teams).where(eq(teams.id, team.id))
    expect(counter!.issueCounter).toBe(20)
  })

  it('never reuses a number after delete', async () => {
    const { user, workspace, team } = await arrange()
    const input = { workspaceId: workspace.id, teamId: team.id, creatorId: user.id, title: 'A' }

    await createIssue(db, input)
    const second = await createIssue(db, input)
    await db.delete(issues).where(eq(issues.id, second.id))

    expect((await createIssue(db, input)).number).toBe(3)
  })

  it('numbers each team independently', async () => {
    const { user, workspace, team } = await arrange()
    const other = await createTeam(db, { workspaceId: workspace.id, key: 'OPS' })
    await insertIssue(db, { teamId: team.id, creatorId: user.id })

    const issue = await createIssue(db, {
      workspaceId: workspace.id,
      teamId: other.id,
      creatorId: user.id,
      title: 'First ops issue',
    })
    expect(issue.number).toBe(1)
  })

  it('defaults to Backlog with no priority and no completedAt', async () => {
    const { user, workspace, team } = await arrange()
    const backlog = await statusNamed(team.id, 'Backlog')

    const issue = await createIssue(db, {
      workspaceId: workspace.id,
      teamId: team.id,
      creatorId: user.id,
      title: '  Fix login  ',
    })
    expect(issue).toMatchObject({
      title: 'Fix login',
      statusId: backlog.id,
      priority: 0,
      completedAt: null,
    })
  })

  it('sets completedAt when created in a completed status', async () => {
    const { user, workspace, team } = await arrange()
    const done = await statusNamed(team.id, 'Done')

    const issue = await createIssue(db, {
      workspaceId: workspace.id,
      teamId: team.id,
      creatorId: user.id,
      title: 'Already done',
      statusId: done.id,
    })
    expect(issue.completedAt).toBeInstanceOf(Date)
  })

  it('rejects a status from another team', async () => {
    const { user, workspace, team } = await arrange()
    const other = await createTeam(db, { workspaceId: workspace.id, key: 'OPS' })
    const foreign = await statusNamed(other.id, 'Todo')

    await expect(
      createIssue(db, {
        workspaceId: workspace.id,
        teamId: team.id,
        creatorId: user.id,
        title: 'X',
        statusId: foreign.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rejects an out-of-range priority, an empty title, and a non-member assignee', async () => {
    const { user, workspace, team } = await arrange()
    const base = { workspaceId: workspace.id, teamId: team.id, creatorId: user.id, title: 'X' }
    const outsider = await createUser(db)

    await expect(createIssue(db, { ...base, priority: 5 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    await expect(createIssue(db, { ...base, title: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    await expect(createIssue(db, { ...base, assigneeId: outsider.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })

    await addMember(db, workspace.id, outsider.id)
    const assigned = await createIssue(db, { ...base, assigneeId: outsider.id })
    expect(assigned.assigneeId).toBe(outsider.id)
  })

  it('returns NOT_FOUND for a team in another workspace', async () => {
    const { user, team } = await arrange()
    const otherWorkspace = await createWorkspace(db, { ownerId: user.id })

    await expect(
      createIssue(db, {
        workspaceId: otherWorkspace.id,
        teamId: team.id,
        creatorId: user.id,
        title: 'X',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

async function workspaceWithTeam() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Tip', key: 'TIP' })
  const status = (name: string) => team.statuses.find((s) => s.name === name)!
  return { owner, workspace, team, status, issues: owner.client.issues }
}

describe('issues procedures', () => {
  it('creates an issue and reads it back by id and case-insensitive identifier', async () => {
    const { owner, team, status, issues } = await workspaceWithTeam()
    const bug = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'Bug',
      color: '#eb5757',
    })

    const issue = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: '  Fix login  ',
      labelIds: [bug.id, bug.id],
    })
    expect(issue).toMatchObject({
      identifier: 'TIP-1',
      number: 1,
      teamId: team.id,
      title: 'Fix login',
      description: null,
      status: status('Backlog'),
      priority: 0,
      assigneeId: null,
      creatorId: owner.userId,
      projectId: null,
      labels: [bug],
      completedAt: null,
      blockedByCount: 0,
      blockingCount: 0,
    })
    expect(issue.createdAt).toBeInstanceOf(Date)

    const relations = { blocks: [], blockedBy: [], related: [], duplicateOf: [], duplicates: [] }
    const detail = { ...issue, parent: null, children: [], relations, links: [] }
    expect(await issues.get({ workspaceSlug: 'tip', id: issue.id })).toEqual(detail)
    expect(await issues.getByIdentifier({ workspaceSlug: 'tip', identifier: 'tip-1' })).toEqual(
      detail,
    )
    await expect(
      issues.getByIdentifier({ workspaceSlug: 'tip', identifier: 'TIP-2' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      issues.getByIdentifier({ workspaceSlug: 'tip', identifier: 'not an id' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('updates properties and keeps completedAt in step with the status category', async () => {
    const { owner, workspace, team, status, issues } = await workspaceWithTeam()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const bug = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'Bug',
      color: '#eb5757',
    })
    const ui = await owner.client.labels.create({
      workspaceSlug: 'tip',
      name: 'UI',
      color: '#5e6ad2',
    })
    const { id } = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'A' })

    const updated = await member.client.issues.update({
      workspaceSlug: 'tip',
      id,
      title: 'B',
      description: 'Steps to reproduce',
      priority: 1,
      assigneeId: member.userId,
      labelIds: [ui.id, bug.id],
    })
    expect(updated).toMatchObject({
      title: 'B',
      description: 'Steps to reproduce',
      priority: 1,
      assigneeId: member.userId,
      labels: [bug, ui],
    })

    const done = await issues.update({ workspaceSlug: 'tip', id, statusId: status('Done').id })
    expect(done.status.category).toBe('completed')
    expect(done.completedAt).toBeInstanceOf(Date)
    const stillDone = await issues.update({ workspaceSlug: 'tip', id, title: 'C' })
    expect(stillDone.completedAt).toEqual(done.completedAt)

    const reopened = await issues.update({
      workspaceSlug: 'tip',
      id,
      statusId: status('In Progress').id,
      assigneeId: null,
      description: null,
      labelIds: [],
    })
    expect(reopened).toMatchObject({
      completedAt: null,
      assigneeId: null,
      description: null,
      labels: [],
      title: 'C',
      priority: 1,
    })
  })

  it('rejects a non-member assignee, foreign labels or statuses, and unknown projects', async () => {
    const { team, issues } = await workspaceWithTeam()
    const outsider = await signUp(app, 'Outsider')
    await outsider.client.workspaces.create({ name: 'Other', slug: 'other' })
    const foreignLabel = await outsider.client.labels.create({
      workspaceSlug: 'other',
      name: 'Bug',
      color: '#eb5757',
    })
    const otherTeam = await outsider.client.teams.create({
      workspaceSlug: 'other',
      name: 'Ops',
      key: 'OPS',
    })
    const base = { workspaceSlug: 'tip', teamId: team.id, title: 'X' }
    const { id } = await issues.create(base)

    for (const change of [
      { assigneeId: outsider.userId },
      { labelIds: [foreignLabel.id] },
      { statusId: otherTeam.statuses[0]!.id },
      { projectId: crypto.randomUUID() },
      { priority: 5 },
    ]) {
      await expect(issues.create({ ...base, ...change })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      })
      await expect(issues.update({ workspaceSlug: 'tip', id, ...change })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      })
    }
  })

  it('deletes an issue', async () => {
    const { team, issues } = await workspaceWithTeam()
    const { id } = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'X' })

    await expect(issues.delete({ workspaceSlug: 'tip', id })).resolves.toEqual({ id })
    await expect(issues.get({ workspaceSlug: 'tip', id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(issues.delete({ workspaceSlug: 'tip', id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('pages newest first with stable cursors and filters by team', async () => {
    const { owner, team, issues } = await workspaceWithTeam()
    const ops = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Ops', key: 'OPS' })
    for (let i = 0; i < 5; i++) {
      await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: `T${i}` })
    }
    await issues.create({ workspaceSlug: 'tip', teamId: ops.id, title: 'Ops' })
    const page = (cursor?: string | null) =>
      issues.list({ workspaceSlug: 'tip', teamId: team.id, limit: 2, cursor })

    const first = await page()
    expect(first.items.map((i) => i.identifier)).toEqual(['TIP-5', 'TIP-4'])
    // A new issue lands before the first page and doesn't shift later pages.
    await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'Late' })
    const second = await page(first.nextCursor)
    expect(second.items.map((i) => i.identifier)).toEqual(['TIP-3', 'TIP-2'])
    expect(await page(first.nextCursor)).toEqual(second)
    const third = await page(second.nextCursor)
    expect(third).toMatchObject({ items: [{ identifier: 'TIP-1' }], nextCursor: null })

    const all = await issues.list({ workspaceSlug: 'tip' })
    expect(all.items).toHaveLength(7)
    expect(all.nextCursor).toBeNull()
    await expect(page('not-a-cursor')).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it("filters to the caller's assigned and created issues within the workspace", async () => {
    const { owner, workspace, team, issues } = await workspaceWithTeam()
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const mine = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Mine',
      assigneeId: owner.userId,
    })
    const theirs = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Theirs',
      assigneeId: member.userId,
    })
    const byMember = await member.client.issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'By member',
      assigneeId: owner.userId,
    })
    // Same user, other workspace: never leaks into Tip's My Issues.
    await owner.client.workspaces.create({ name: 'Other', slug: 'other' })
    const other = await owner.client.teams.create({ workspaceSlug: 'other', name: 'O', key: 'OTH' })
    await issues.create({
      workspaceSlug: 'other',
      teamId: other.id,
      assigneeId: owner.userId,
      title: 'X',
    })

    const ids = async (input: { assignee?: 'me'; creator?: 'me' }, client = issues) =>
      (await client.list({ workspaceSlug: 'tip', ...input })).items.map((i) => i.id)

    expect(await ids({ assignee: 'me' })).toEqual([byMember.id, mine.id])
    expect(await ids({ assignee: 'me' }, member.client.issues)).toEqual([theirs.id])
    expect(await ids({ creator: 'me' })).toEqual([theirs.id, mine.id])
    expect(await ids({ creator: 'me' }, member.client.issues)).toEqual([byMember.id])
  })

  it('hides issues from non-members and other workspaces', async () => {
    const { team, issues } = await workspaceWithTeam()
    const issue = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'Secret' })
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const theirs = stranger.client.issues
    const notFound = { code: 'NOT_FOUND' }

    await expect(rpcClient(app).issues.list({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    await expect(theirs.list({ workspaceSlug: 'tip' })).rejects.toMatchObject(notFound)
    await expect(theirs.get({ workspaceSlug: 'tip', id: issue.id })).rejects.toMatchObject(notFound)
    // Ids from another workspace are invisible through the stranger's own workspace.
    await expect(theirs.get({ workspaceSlug: 'mine', id: issue.id })).rejects.toMatchObject(
      notFound,
    )
    await expect(
      theirs.getByIdentifier({ workspaceSlug: 'mine', identifier: 'TIP-1' }),
    ).rejects.toMatchObject(notFound)
    await expect(
      theirs.update({ workspaceSlug: 'mine', id: issue.id, title: 'Hijacked' }),
    ).rejects.toMatchObject(notFound)
    await expect(theirs.delete({ workspaceSlug: 'mine', id: issue.id })).rejects.toMatchObject(
      notFound,
    )
    await expect(
      theirs.create({ workspaceSlug: 'mine', teamId: team.id, title: 'X' }),
    ).rejects.toMatchObject(notFound)
    expect((await theirs.list({ workspaceSlug: 'mine' })).items).toEqual([])
    expect(await issues.get({ workspaceSlug: 'tip', id: issue.id })).toMatchObject({
      title: 'Secret',
    })
  })
})

describe('issue attachments', () => {
  type Client = Awaited<ReturnType<typeof signUp>>['client']

  /** Presigns, "uploads" and confirms a ready attachment in the workspace. */
  async function readyAttachment(client: Client, workspaceSlug = 'tip') {
    const { uploadId } = await client.uploads.createPresignedUpload({
      kind: 'attachment',
      contentType: 'application/pdf',
      size: 10,
      workspaceSlug,
    })
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, uploadId))
    objects.set(upload!.objectKey, { body: new Uint8Array(10), contentType: upload!.contentType })
    await client.uploads.confirm({ uploadId })
    return uploadId
  }

  const ref = (uploadId: string) => `[spec.pdf](attachment:${uploadId})`

  async function linkedUploadIds(issueId: string) {
    const rows = await db
      .select({ uploadId: issueAttachments.uploadId })
      .from(issueAttachments)
      .where(eq(issueAttachments.issueId, issueId))
    return rows.map((row) => row.uploadId).sort()
  }

  async function uploadStatus(uploadId: string) {
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, uploadId))
    return upload!.status
  }

  async function deleteJobs() {
    const jobs = await queues.maintenance.getJobs(['waiting', 'delayed'])
    return jobs.filter((job) => job.name === 'delete-objects').map((job) => job.data.uploadId)
  }

  it('links referenced attachments and deletes them with the issue', async () => {
    const { owner, team, issues } = await workspaceWithTeam()
    const [a, b] = [await readyAttachment(owner.client), await readyAttachment(owner.client)]

    const issue = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'With files',
      description: `![shot](attachment:${a})\n\n${ref(b)} and ${ref(a)}`,
    })
    expect(await linkedUploadIds(issue.id)).toEqual([a, b].sort())

    await issues.delete({ workspaceSlug: 'tip', id: issue.id })
    expect(await linkedUploadIds(issue.id)).toEqual([])
    expect([await uploadStatus(a), await uploadStatus(b)]).toEqual(['deleted', 'deleted'])
    expect((await deleteJobs()).sort()).toEqual([a, b].sort())
  })

  it('syncs links on description updates, leaving removed files to the sweep', async () => {
    const { owner, team, issues } = await workspaceWithTeam()
    const [a, b] = [await readyAttachment(owner.client), await readyAttachment(owner.client)]
    const issue = await issues.create({
      workspaceSlug: 'tip',
      teamId: team.id,
      title: 'Edit me',
      description: ref(a),
    })

    await issues.update({ workspaceSlug: 'tip', id: issue.id, description: ref(b) })
    expect(await linkedUploadIds(issue.id)).toEqual([b])
    // Unlinked but kept for now, so an undo can bring the reference back.
    expect(await uploadStatus(a)).toBe('ready')

    // Updates that leave the description alone keep the links.
    await issues.update({ workspaceSlug: 'tip', id: issue.id, title: 'Renamed' })
    expect(await linkedUploadIds(issue.id)).toEqual([b])

    await issues.update({ workspaceSlug: 'tip', id: issue.id, description: null })
    expect(await linkedUploadIds(issue.id)).toEqual([])
    expect(await deleteJobs()).toEqual([])
  })

  it('keeps an attachment that another issue still references', async () => {
    const { owner, team, issues } = await workspaceWithTeam()
    const a = await readyAttachment(owner.client)
    const input = { workspaceSlug: 'tip', teamId: team.id, description: ref(a) }
    const first = await issues.create({ ...input, title: 'First' })
    const second = await issues.create({ ...input, title: 'Second' })

    await issues.delete({ workspaceSlug: 'tip', id: first.id })
    expect(await uploadStatus(a)).toBe('ready')
    expect(await deleteJobs()).toEqual([])

    await issues.delete({ workspaceSlug: 'tip', id: second.id })
    expect(await uploadStatus(a)).toBe('deleted')
    expect(await deleteJobs()).toEqual([a])
  })

  it('rejects references to uploads that are not ready attachments in the workspace', async () => {
    const { owner, team, issues } = await workspaceWithTeam()
    await owner.client.workspaces.create({ name: 'Other', slug: 'other' })
    const foreign = await readyAttachment(owner.client, 'other')
    const { uploadId: pending } = await owner.client.uploads.createPresignedUpload({
      kind: 'attachment',
      contentType: 'application/pdf',
      size: 10,
      workspaceSlug: 'tip',
    })
    const { uploadId: icon } = await owner.client.uploads.createPresignedUpload({
      kind: 'project_icon',
      contentType: 'image/png',
      size: 10,
      workspaceSlug: 'tip',
    })
    await db.update(uploads).set({ status: 'ready' }).where(eq(uploads.id, icon))
    const unknown = '01890a5d-ac96-774b-bcce-b302099a8057'
    const issue = await issues.create({ workspaceSlug: 'tip', teamId: team.id, title: 'X' })

    for (const uploadId of [foreign, pending, icon, unknown]) {
      await expect(
        issues.create({
          workspaceSlug: 'tip',
          teamId: team.id,
          title: 'Bad',
          description: ref(uploadId),
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      await expect(
        issues.update({ workspaceSlug: 'tip', id: issue.id, description: ref(uploadId) }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
    // Nothing was created or changed by the rejected writes.
    const page = await issues.list({ workspaceSlug: 'tip', limit: 50 })
    expect(page.items.map((i) => i.title)).toEqual(['X'])
    expect((await issues.get({ workspaceSlug: 'tip', id: issue.id })).description).toBeNull()
    expect(await uploadStatus(foreign)).toBe('ready')
  })
})

describe('issues.list filters, sorting and search', () => {
  /** TIP-1..TIP-5 with distinct properties, created oldest to newest. */
  async function seeded() {
    const ctx = await workspaceWithTeam()
    const { owner, workspace, team, status, issues } = ctx
    const member = await signUp(app, 'Member')
    await addMember(db, workspace.id, member.userId)
    const project = await owner.client.projects.create({ workspaceSlug: 'tip', name: 'Launch' })
    const label = (name: string) =>
      owner.client.labels.create({ workspaceSlug: 'tip', name, color: '#eb5757' })
    const [bug, ui] = [await label('Bug'), await label('UI')]
    const create = (title: string, fields: Record<string, unknown> = {}) =>
      issues.create({ workspaceSlug: 'tip', teamId: team.id, title, ...fields })

    const tip1 = await create('Fix login redirect', { priority: 3, labelIds: [bug.id] })
    const tip2 = await create('100% width header', {
      priority: 1,
      assigneeId: member.userId,
      statusId: status('Todo').id,
    })
    const tip3 = await create('Dark mode', {
      priority: 0,
      projectId: project.id,
      labelIds: [ui.id],
    })
    const tip4 = await create('Login form polish', {
      priority: 4,
      assigneeId: owner.userId,
      projectId: project.id,
      labelIds: [bug.id, ui.id],
    })
    const tip5 = await create('Onboarding', { priority: 2, statusId: status('Todo').id })
    const ids = async (filter: Partial<ListIssuesInput> = {}) =>
      (await issues.list({ workspaceSlug: 'tip', ...filter })).items.map((i) => i.identifier)
    return {
      ...ctx,
      member,
      project,
      bug,
      ui,
      created: [tip1, tip2, tip3, tip4, tip5],
      ids,
    }
  }

  it('filters by status, priority, assignee, project and labels', async () => {
    const { owner, member, project, bug, ui, status, ids } = await seeded()

    expect(await ids({ statusIds: [status('Todo').id] })).toEqual(['TIP-5', 'TIP-2'])
    expect(await ids({ statusIds: [status('Todo').id, status('Backlog').id] })).toHaveLength(5)
    expect(await ids({ priorities: [1, 2] })).toEqual(['TIP-5', 'TIP-2'])
    expect(await ids({ priorities: [0] })).toEqual(['TIP-3'])
    expect(await ids({ assigneeIds: [member.userId] })).toEqual(['TIP-2'])
    expect(await ids({ assigneeIds: [null] })).toEqual(['TIP-5', 'TIP-3', 'TIP-1'])
    expect(await ids({ assigneeIds: [owner.userId, null] })).toEqual([
      'TIP-5',
      'TIP-4',
      'TIP-3',
      'TIP-1',
    ])
    expect(await ids({ projectIds: [project.id] })).toEqual(['TIP-4', 'TIP-3'])
    expect(await ids({ projectIds: [null] })).toEqual(['TIP-5', 'TIP-2', 'TIP-1'])
    // Labels match any of the given labels.
    expect(await ids({ labelIds: [bug.id] })).toEqual(['TIP-4', 'TIP-1'])
    expect(await ids({ labelIds: [bug.id, ui.id] })).toEqual(['TIP-4', 'TIP-3', 'TIP-1'])
    // Different filters combine with AND; an empty list doesn't filter.
    expect(await ids({ labelIds: [ui.id], projectIds: [project.id], priorities: [4] })).toEqual([
      'TIP-4',
    ])
    expect(await ids({ statusIds: [], labelIds: [] })).toHaveLength(5)
    // Ids from elsewhere just match nothing.
    expect(await ids({ labelIds: [crypto.randomUUID()] })).toEqual([])
  })

  it('filters by status category (view tabs), combined with status ids', async () => {
    const { issues, created, status, ids } = await seeded()
    // TIP-2 and TIP-5 are Todo (unstarted); move TIP-4 to In Progress and TIP-3 to Done.
    await issues.update({
      workspaceSlug: 'tip',
      id: created[3]!.id,
      statusId: status('In Progress').id,
    })
    await issues.update({ workspaceSlug: 'tip', id: created[2]!.id, statusId: status('Done').id })

    // Active = started + unstarted, Backlog = backlog.
    expect(await ids({ statusCategories: ['started', 'unstarted'] })).toEqual([
      'TIP-5',
      'TIP-4',
      'TIP-2',
    ])
    expect(await ids({ statusCategories: ['backlog'] })).toEqual(['TIP-1'])
    expect(await ids({ statusCategories: ['completed'] })).toEqual(['TIP-3'])
    // An empty list doesn't filter.
    expect(await ids({ statusCategories: [] })).toHaveLength(5)
    // AND with status ids: a status outside the categories matches nothing.
    expect(
      await ids({ statusCategories: ['started', 'unstarted'], statusIds: [status('Todo').id] }),
    ).toEqual(['TIP-5', 'TIP-2'])
    expect(await ids({ statusCategories: ['backlog'], statusIds: [status('Todo').id] })).toEqual([])
    // Combines with the page scope and other filters too.
    expect(await ids({ statusCategories: ['unstarted'], priorities: [1] })).toEqual(['TIP-2'])
    // Unknown categories are rejected by the contract.
    await expect(
      issues.list({ workspaceSlug: 'tip', statusCategories: ['doing' as 'started'] }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    // Another workspace's members can't list these issues, by category or otherwise.
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    await expect(
      stranger.client.issues.list({ workspaceSlug: 'tip', statusCategories: ['backlog'] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(
      (await stranger.client.issues.list({ workspaceSlug: 'mine', statusCategories: ['backlog'] }))
        .items,
    ).toEqual([])
  })

  it('counts issues per assignee, label, priority and project for the same filters', async () => {
    const { owner, member, project, bug, ui, team, issues } = await seeded()
    const facets = (filter: Partial<ListIssuesInput> = {}) =>
      issues.facets({ workspaceSlug: 'tip', ...filter })

    // Most common first; ties by id. Unassigned / no project are `null` rows, and
    // TIP-4 (Bug + UI) counts once under each label.
    expect(await facets()).toEqual({
      assignees: [
        { id: null, count: 3 },
        { id: owner.userId, count: 1 },
        { id: member.userId, count: 1 },
      ],
      labels: [
        { id: bug.id, count: 2 },
        { id: ui.id, count: 2 },
      ],
      priorities: [0, 1, 2, 3, 4].map((value) => ({ value, count: 1 })),
      projects: [
        { id: null, count: 3 },
        { id: project.id, count: 2 },
      ],
    })

    // Filters narrow the counts exactly like they narrow the list (TIP-1, TIP-4).
    // On a tie, the `null` row comes last.
    expect(await facets({ labelIds: [bug.id], teamId: team.id })).toEqual({
      assignees: [
        { id: owner.userId, count: 1 },
        { id: null, count: 1 },
      ],
      labels: [
        { id: bug.id, count: 2 },
        { id: ui.id, count: 1 },
      ],
      priorities: [
        { value: 3, count: 1 },
        { value: 4, count: 1 },
      ],
      projects: [
        { id: project.id, count: 1 },
        { id: null, count: 1 },
      ],
    })
    // The Active tab: TIP-2 and TIP-5 are Todo, without labels or a project.
    expect(await facets({ statusCategories: ['unstarted'] })).toMatchObject({
      assignees: [
        { id: member.userId, count: 1 },
        { id: null, count: 1 },
      ],
      labels: [],
      projects: [{ id: null, count: 2 }],
    })
    expect((await facets({ assignee: 'me' })).assignees).toEqual([{ id: owner.userId, count: 1 }])
    // `'me'` in subscriberIds is the session user, like in `issues.list`.
    const subscribed = await issues.list({ workspaceSlug: 'tip', subscriberIds: ['me'] })
    expect(subscribed.items.length).toBeGreaterThan(0)
    const subscribedCounts = (await facets({ subscriberIds: ['me'] })).assignees
    expect(subscribedCounts.reduce((sum, row) => sum + row.count, 0)).toBe(subscribed.items.length)
    expect((await facets({ projectId: project.id })).projects).toEqual([
      { id: project.id, count: 2 },
    ])
    expect(await facets({ q: 'nothing matches' })).toEqual({
      assignees: [],
      labels: [],
      priorities: [],
      projects: [],
    })
  })

  it('rejects facets for another workspace and its team, project or cycle scope', async () => {
    const { owner, team, project } = await seeded()
    await owner.client.teams.update({ workspaceSlug: 'tip', key: 'TIP', cyclesEnabled: true })
    const [cycle] = await owner.client.cycles.list({ workspaceSlug: 'tip', teamId: team.id })
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Mine', slug: 'mine' })
    const notFound = { code: 'NOT_FOUND' }

    await expect(stranger.client.issues.facets({ workspaceSlug: 'tip' })).rejects.toMatchObject(
      notFound,
    )
    await expect(
      stranger.client.issues.facets({ workspaceSlug: 'mine', teamId: team.id }),
    ).rejects.toMatchObject(notFound)
    await expect(
      stranger.client.issues.facets({ workspaceSlug: 'mine', projectId: project.id }),
    ).rejects.toMatchObject(notFound)
    await expect(
      stranger.client.issues.facets({ workspaceSlug: 'mine', cycleId: cycle!.id }),
    ).rejects.toMatchObject(notFound)
    // Unscoped, the stranger's own workspace has nothing to count.
    expect((await stranger.client.issues.facets({ workspaceSlug: 'mine' })).assignees).toEqual([])
    await expect(rpcClient(app).issues.facets({ workspaceSlug: 'tip' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('sorts by created, updated and priority in both directions, with stable cursors', async () => {
    const { issues, created, ids } = await seeded()

    expect(await ids()).toEqual(['TIP-5', 'TIP-4', 'TIP-3', 'TIP-2', 'TIP-1'])
    expect(await ids({ sort: 'createdAt', direction: 'asc' })).toEqual([
      'TIP-1',
      'TIP-2',
      'TIP-3',
      'TIP-4',
      'TIP-5',
    ])

    await issues.update({ workspaceSlug: 'tip', id: created[1]!.id, title: 'Touched' })
    expect(await ids({ sort: 'updatedAt' })).toEqual(['TIP-2', 'TIP-5', 'TIP-4', 'TIP-3', 'TIP-1'])
    expect(await ids({ sort: 'updatedAt', direction: 'asc' })).toEqual([
      'TIP-1',
      'TIP-3',
      'TIP-4',
      'TIP-5',
      'TIP-2',
    ])

    // Urgent first (desc) or Low first (asc); No priority is last either way.
    expect(await ids({ sort: 'priority' })).toEqual(['TIP-2', 'TIP-5', 'TIP-1', 'TIP-4', 'TIP-3'])
    expect(await ids({ sort: 'priority', direction: 'asc' })).toEqual([
      'TIP-4',
      'TIP-1',
      'TIP-5',
      'TIP-2',
      'TIP-3',
    ])

    // Paging one row at a time walks the same order for every sort, including ties.
    await issues.update({ workspaceSlug: 'tip', id: created[3]!.id, priority: 1 })
    for (const sort of ['createdAt', 'updatedAt', 'priority'] as const) {
      for (const direction of ['asc', 'desc'] as const) {
        const expected = await ids({ sort, direction })
        const walked: string[] = []
        let cursor: string | null = null
        do {
          const page = await issues.list({
            workspaceSlug: 'tip',
            sort,
            direction,
            limit: 1,
            cursor,
          })
          walked.push(...page.items.map((i) => i.identifier))
          cursor = page.nextCursor
        } while (cursor)
        expect(walked, `${sort} ${direction}`).toEqual(expected)
      }
    }
    expect(await ids({ sort: 'priority' })).toEqual(['TIP-4', 'TIP-2', 'TIP-5', 'TIP-1', 'TIP-3'])

    // A cursor only fits the sort it was issued for.
    const { nextCursor } = await issues.list({ workspaceSlug: 'tip', sort: 'priority', limit: 1 })
    await expect(
      issues.list({ workspaceSlug: 'tip', sort: 'createdAt', limit: 1, cursor: nextCursor }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('searches titles case-insensitively and finds issues by identifier', async () => {
    const { owner, issues, ids } = await seeded()
    const ops = await owner.client.teams.create({ workspaceSlug: 'tip', name: 'Ops', key: 'OPS' })
    await issues.create({ workspaceSlug: 'tip', teamId: ops.id, title: 'Rotate keys' })

    expect(await ids({ q: 'login' })).toEqual(['TIP-4', 'TIP-1'])
    expect(await ids({ q: '  LOGIN form ' })).toEqual(['TIP-4'])
    // LIKE wildcards in the query match literally.
    expect(await ids({ q: '100%' })).toEqual(['TIP-2'])
    expect(await ids({ q: '%' })).toEqual(['TIP-2'])
    expect(await ids({ q: '_' })).toEqual([])
    expect(await ids({ q: 'tip-3' })).toEqual(['TIP-3'])
    expect(await ids({ q: 'OPS-1' })).toEqual(['OPS-1'])
    expect(await ids({ q: 'ops-2' })).toEqual([])
    // Search combines with filters.
    expect(await ids({ q: 'login', priorities: [3] })).toEqual(['TIP-1'])
  })
})
