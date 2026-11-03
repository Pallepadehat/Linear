import { projectProgressSnapshots, workflowStatuses } from '@linear/db'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { rpcClient, setupTestApp, signUp } from './harness'

const { app, db, queues } = await setupTestApp()
const scope = { workspaceSlug: 'tip' }

const day = (offset: number) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

async function arrange() {
  const owner = await signUp(app, 'Owner')
  const { workspace } = await owner.client.workspaces.create({ name: 'Tip', slug: 'tip' })
  const team = await owner.client.teams.create({ ...scope, name: 'Tip', key: 'TIP' })
  const project = await owner.client.projects.create({ ...scope, name: 'Launch' })
  const statusOf = async (category: 'started' | 'completed' | 'canceled') => {
    const [status] = await db
      .select({ id: workflowStatuses.id })
      .from(workflowStatuses)
      .where(and(eq(workflowStatuses.teamId, team.id), eq(workflowStatuses.category, category)))
    return status!.id
  }
  const issue = (
    title: string,
    extra: { statusId?: string; assigneeId?: string; labelIds?: string[] } = {},
  ) =>
    owner.client.issues.create({
      ...scope,
      teamId: team.id,
      title,
      projectId: project.id,
      ...extra,
    })
  return { owner, workspace, team, project, statusOf, issue }
}

async function snapshotJobs() {
  const jobs = await queues.maintenance.getJobs(['waiting', 'delayed'])
  return jobs.filter((job) => job.name === 'project-progress-snapshot').map((job) => job.data)
}

describe('projects.progress', () => {
  it('returns the stored series with live counts for today, totals and breakdowns', async () => {
    const { owner, workspace, project, statusOf, issue } = await arrange()
    const bug = await owner.client.labels.create({ ...scope, name: 'Bug', color: '#eb5757' })
    const ui = await owner.client.labels.create({ ...scope, name: 'UI', color: '#5e6ad2' })
    const started = await statusOf('started')
    const completed = await statusOf('completed')
    await issue('A', { statusId: completed, assigneeId: owner.userId, labelIds: [bug.id] })
    await issue('B', { statusId: started, assigneeId: owner.userId, labelIds: [bug.id, ui.id] })
    await issue('C', { statusId: await statusOf('canceled') })
    await issue('D')

    await db.insert(projectProgressSnapshots).values([
      {
        workspaceId: workspace.id,
        projectId: project.id,
        date: day(-1),
        scope: 3,
        started: 1,
        completed: 1,
      },
      {
        workspaceId: workspace.id,
        projectId: project.id,
        date: day(-2),
        scope: 2,
        started: 0,
        completed: 0,
      },
      // Stale: today's point always comes from the live counts.
      {
        workspaceId: workspace.id,
        projectId: project.id,
        date: day(0),
        scope: 1,
        started: 0,
        completed: 0,
      },
    ])

    const progress = await owner.client.projects.progress({ ...scope, projectId: project.id })
    expect(progress.series).toEqual([
      { date: day(-2), scope: 2, started: 0, completed: 0 },
      { date: day(-1), scope: 3, started: 1, completed: 1 },
      { date: day(0), scope: 4, started: 1, completed: 1 },
    ])
    expect(progress.totals).toEqual({ scope: 4, started: 1, completed: 1 })
    expect(progress.byAssignee).toEqual([
      { userId: owner.userId, name: 'Owner', done: 1, total: 2 },
      { userId: null, name: 'No assignee', done: 0, total: 2 },
    ])
    expect(progress.byLabel).toEqual([
      { labelId: bug.id, name: 'Bug', color: '#eb5757', done: 1, total: 2 },
      { labelId: ui.id, name: 'UI', color: '#5e6ad2', done: 0, total: 1 },
    ])
  })

  it('has a single live point and empty breakdowns for a project without issues', async () => {
    const { owner, project } = await arrange()
    expect(await owner.client.projects.progress({ ...scope, projectId: project.id })).toEqual({
      series: [{ date: day(0), scope: 0, started: 0, completed: 0 }],
      totals: { scope: 0, started: 0, completed: 0 },
      byAssignee: [],
      byLabel: [],
    })
  })

  it('rejects other workspaces as NOT_FOUND and anonymous callers', async () => {
    const { project } = await arrange()
    const stranger = await signUp(app, 'Stranger')
    await stranger.client.workspaces.create({ name: 'Other', slug: 'other' })
    const foreign = await stranger.client.projects.create({
      workspaceSlug: 'other',
      name: 'Theirs',
    })

    await expect(
      stranger.client.projects.progress({ ...scope, projectId: project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // A member of `other` asking for a `tip` project through their own workspace.
    await expect(
      stranger.client.projects.progress({ workspaceSlug: 'other', projectId: project.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      rpcClient(app).projects.progress({ workspaceSlug: 'other', projectId: foreign.id }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('queues one debounced snapshot per project after issue changes that move its counts', async () => {
    const { owner, project, statusOf, issue } = await arrange()
    const other = await owner.client.projects.create({ ...scope, name: 'Other' })
    const created = await issue('A')
    await owner.client.issues.update({
      ...scope,
      id: created.id,
      statusId: await statusOf('started'),
    })
    expect(await snapshotJobs()).toEqual([{ projectId: project.id }])

    // A title change doesn't move the counts.
    await queues.maintenance.obliterate({ force: true })
    await owner.client.issues.update({ ...scope, id: created.id, title: 'Renamed' })
    expect(await snapshotJobs()).toEqual([])

    // Moving the issue refreshes both projects.
    await owner.client.issues.update({ ...scope, id: created.id, projectId: other.id })
    expect(await snapshotJobs()).toEqual(
      expect.arrayContaining([{ projectId: project.id }, { projectId: other.id }]),
    )

    await queues.maintenance.obliterate({ force: true })
    await owner.client.issues.delete({ ...scope, id: created.id })
    expect(await snapshotJobs()).toEqual([{ projectId: other.id }])
  })
})
