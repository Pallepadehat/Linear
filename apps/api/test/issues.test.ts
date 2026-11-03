import { createIssue } from '@linear/core'
import { issues, teams, workflowStatuses } from '@linear/db'
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

const { app, db } = await setupTestApp()

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
    })
    expect(issue.createdAt).toBeInstanceOf(Date)

    expect(await issues.get({ workspaceSlug: 'tip', id: issue.id })).toEqual(issue)
    expect(await issues.getByIdentifier({ workspaceSlug: 'tip', identifier: 'tip-1' })).toEqual(
      issue,
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
