import { createDb, projectProgressSnapshots, projects, workflowStatuses } from '@linear/db'
import {
  createIssue,
  createTeam,
  createUser,
  createWorkspace,
  testDatabaseUrl,
  truncateAll,
} from '@linear/db/testing'
import { loadRootEnvFile } from '@linear/env'
import { and, asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  projectProgressDaily,
  projectProgressSnapshot,
} from '../src/jobs/projects/project-progress-snapshot'
import { createTestJobDeps } from '../src/testing'

loadRootEnvFile()
const { db, close } = createDb(testDatabaseUrl(), { max: 2 })
const deps = createTestJobDeps(db)

beforeEach(() => truncateAll(db))
afterAll(close)

const MORNING = new Date('2026-11-03T08:00:00Z')
const EVENING = new Date('2026-11-03T23:55:00Z')
const NEXT_DAY = new Date('2026-11-04T23:55:00Z')

async function arrange() {
  const user = await createUser(db)
  const workspace = await createWorkspace(db, { ownerId: user.id })
  const team = await createTeam(db, { workspaceId: workspace.id, key: 'TIP' })
  const [project] = await db
    .insert(projects)
    .values({ workspaceId: workspace.id, name: 'Launch', status: 'in_progress' })
    .returning()
  const statusOf = async (category: 'started' | 'completed') => {
    const [status] = await db
      .select()
      .from(workflowStatuses)
      .where(and(eq(workflowStatuses.teamId, team.id), eq(workflowStatuses.category, category)))
    return status!.id
  }
  const issue = (statusId?: string) =>
    createIssue(db, {
      teamId: team.id,
      creatorId: user.id,
      projectId: project!.id,
      ...(statusId ? { statusId } : {}),
    })
  return { user, workspace, team, project: project!, statusOf, issue }
}

const rows = () =>
  db
    .select({
      date: projectProgressSnapshots.date,
      scope: projectProgressSnapshots.scope,
      started: projectProgressSnapshots.started,
      completed: projectProgressSnapshots.completed,
    })
    .from(projectProgressSnapshots)
    .orderBy(asc(projectProgressSnapshots.date))

describe('project-progress-snapshot', () => {
  it('writes one row per project and day, updated to the latest counts', async () => {
    const { project, statusOf, issue } = await arrange()
    await issue()
    await issue(await statusOf('started'))
    await projectProgressSnapshot(deps, project.id, MORNING)
    await projectProgressSnapshot(deps, project.id, MORNING)
    expect(await rows()).toEqual([{ date: '2026-11-03', scope: 2, started: 1, completed: 0 }])

    await issue(await statusOf('completed'))
    await projectProgressSnapshot(deps, project.id, EVENING)
    expect(await rows()).toEqual([{ date: '2026-11-03', scope: 3, started: 1, completed: 1 }])

    await projectProgressSnapshot(deps, project.id, NEXT_DAY)
    expect(await rows()).toHaveLength(2)
  })

  it('ignores a project that was deleted before the job ran', async () => {
    const { project } = await arrange()
    await db.delete(projects).where(eq(projects.id, project.id))
    await projectProgressSnapshot(deps, project.id, MORNING)
    expect(await rows()).toEqual([])
  })
})

describe('project-progress-daily', () => {
  it('snapshots planned and in-progress projects only, idempotently', async () => {
    const { workspace, project, issue } = await arrange()
    await issue()
    await db.insert(projects).values([
      { workspaceId: workspace.id, name: 'Planned', status: 'planned' },
      { workspaceId: workspace.id, name: 'Shipped', status: 'completed' },
      { workspaceId: workspace.id, name: 'Dropped', status: 'canceled' },
    ])
    await projectProgressDaily(deps, EVENING)
    await projectProgressDaily(deps, EVENING)
    const snapshots = await db
      .select({
        projectId: projectProgressSnapshots.projectId,
        scope: projectProgressSnapshots.scope,
      })
      .from(projectProgressSnapshots)
    expect(snapshots).toHaveLength(2)
    expect(snapshots).toContainEqual({ projectId: project.id, scope: 1 })
  })
})
