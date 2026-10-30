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
import { setupTestApp } from './harness'

const { db } = await setupTestApp()

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

  it('defaults to Todo with no priority and no completedAt', async () => {
    const { user, workspace, team } = await arrange()
    const todo = await statusNamed(team.id, 'Todo')

    const issue = await createIssue(db, {
      workspaceId: workspace.id,
      teamId: team.id,
      creatorId: user.id,
      title: '  Fix login  ',
    })
    expect(issue).toMatchObject({
      title: 'Fix login',
      statusId: todo.id,
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
