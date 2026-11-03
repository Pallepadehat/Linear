import type { teams } from '@linear/db'
import { createDb, cycles, issues, workflowStatuses, type DbOrTx } from '@linear/db'
import {
  createIssue,
  createTeam,
  createUser,
  createWorkspace,
  testDatabaseUrl,
  truncateAll,
} from '@linear/db/testing'
import { loadRootEnvFile } from '@linear/env'
import type { RealtimeEvent } from '@linear/queue'
import { createMemoryStorage } from '@linear/storage/testing'
import { and, asc, eq } from 'drizzle-orm'
import { pino } from 'pino'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { cyclesMaintain } from '../src/jobs/maintenance/cycles-maintain'

loadRootEnvFile()
const { db, close } = createDb(testDatabaseUrl(), { max: 2 })
const published: { workspaceId: string; event: RealtimeEvent }[] = []
const deps = {
  db,
  storage: createMemoryStorage().storage,
  logger: pino({ level: 'silent' }),
  publish: async (workspaceId: string, event: RealtimeEvent) => {
    published.push({ workspaceId, event })
  },
}

beforeEach(async () => {
  await truncateAll(db)
  published.length = 0
})
afterAll(close)

// Tuesday; two-week cycles start on Mondays, so cycle 1 is Nov 2 – Nov 16.
const NOW = new Date('2026-11-03T15:00:00Z')
const LATER = new Date('2026-11-16T01:00:00Z')

async function arrange(overrides: Partial<typeof teams.$inferInsert> = {}) {
  const user = await createUser(db)
  const workspace = await createWorkspace(db, { ownerId: user.id })
  const team = await createTeam(db, {
    workspaceId: workspace.id,
    key: 'TIP',
    cyclesEnabled: true,
    ...overrides,
  })
  const statusOf = async (category: 'unstarted' | 'started' | 'completed' | 'canceled') => {
    const [status] = await db
      .select()
      .from(workflowStatuses)
      .where(and(eq(workflowStatuses.teamId, team.id), eq(workflowStatuses.category, category)))
    return status!.id
  }
  return { user, workspace, team, statusOf }
}

const teamCycles = (teamId: string) =>
  db.select().from(cycles).where(eq(cycles.teamId, teamId)).orderBy(asc(cycles.number))
const cycleOf = async (db: DbOrTx, issueId: string) =>
  (await db.select({ cycleId: issues.cycleId }).from(issues).where(eq(issues.id, issueId)))[0]!
    .cycleId

describe('cycles-maintain', () => {
  it('schedules the current and upcoming cycles, and reruns change nothing', async () => {
    const { team } = await arrange()
    await cyclesMaintain(deps, NOW)
    const first = await teamCycles(team.id)
    expect(first.map((c) => [c.number, c.startsAt.toISOString()])).toEqual([
      [1, '2026-11-02T00:00:00.000Z'],
      [2, '2026-11-16T00:00:00.000Z'],
      [3, '2026-11-30T00:00:00.000Z'],
    ])

    await cyclesMaintain(deps, NOW)
    await cyclesMaintain(deps, new Date(NOW.getTime() + 10 * 60 * 1000))
    const again = await teamCycles(team.id)
    expect(again.map((c) => c.id)).toEqual(first.map((c) => c.id))
    expect(again[0]!.scopeSnapshot).toEqual([null, 0])
  })

  it('skips teams with cycles off', async () => {
    const { team } = await arrange({ cyclesEnabled: false })
    await cyclesMaintain(deps, NOW)
    expect(await teamCycles(team.id)).toEqual([])
  })

  it("records the day's scope and completed counts", async () => {
    const { user, team, statusOf } = await arrange()
    await cyclesMaintain(deps, NOW)
    const [current] = await teamCycles(team.id)
    const base = { teamId: team.id, creatorId: user.id, cycleId: current!.id }
    await createIssue(db, { ...base, statusId: await statusOf('unstarted') })
    await createIssue(db, { ...base, statusId: await statusOf('started') })
    await createIssue(db, { ...base, statusId: await statusOf('completed') })
    await createIssue(db, { ...base, statusId: await statusOf('canceled') })

    await cyclesMaintain(deps, NOW)
    // Same day: the point is replaced, not appended.
    await cyclesMaintain(deps, NOW)
    const [cycle] = await teamCycles(team.id)
    expect(cycle!.scopeSnapshot).toEqual([null, 3])
    expect(cycle!.completedSnapshot).toEqual([null, 1])

    await cyclesMaintain(deps, new Date('2026-11-05T09:00:00Z'))
    const [later] = await teamCycles(team.id)
    expect(later!.scopeSnapshot).toEqual([null, 3, null, 3])
  })

  it('closes an ended cycle and rolls unfinished issues into the next one', async () => {
    const { user, workspace, team, statusOf } = await arrange()
    await cyclesMaintain(deps, NOW)
    const [current, next] = await teamCycles(team.id)
    const base = { teamId: team.id, creatorId: user.id, cycleId: current!.id }
    const todo = await createIssue(db, { ...base, statusId: await statusOf('unstarted') })
    const doing = await createIssue(db, { ...base, statusId: await statusOf('started') })
    const done = await createIssue(db, { ...base, statusId: await statusOf('completed') })
    const dropped = await createIssue(db, { ...base, statusId: await statusOf('canceled') })

    await cyclesMaintain(deps, LATER)
    const after = await teamCycles(team.id)
    expect(after[0]!.completedAt).toEqual(LATER)
    expect(after[1]!.completedAt).toBeNull()
    // A new upcoming cycle keeps two ahead of the new current one.
    expect(after.map((c) => c.number)).toEqual([1, 2, 3, 4])
    // The closed cycle's last day counts the issues before they moved on.
    expect(after[0]!.scopeSnapshot.at(-1)).toBe(3)
    expect(after[0]!.scopeSnapshot).toHaveLength(14)

    expect(await cycleOf(db, todo.id)).toBe(next!.id)
    expect(await cycleOf(db, doing.id)).toBe(next!.id)
    expect(await cycleOf(db, done.id)).toBe(current!.id)
    expect(await cycleOf(db, dropped.id)).toBe(current!.id)
    expect(published.map((p) => [p.workspaceId, p.event])).toEqual(
      expect.arrayContaining([
        [
          workspace.id,
          expect.objectContaining({
            type: 'issue.updated',
            issueId: todo.id,
            fields: ['cycle'],
            actorId: null,
          }),
        ],
        [workspace.id, expect.objectContaining({ type: 'issue.updated', issueId: doing.id })],
      ]),
    )
    expect(published).toHaveLength(2)

    // Rerunning closes nothing twice and moves nothing again.
    published.length = 0
    await cyclesMaintain(deps, LATER)
    expect((await teamCycles(team.id))[0]!.completedAt).toEqual(LATER)
    expect(published).toEqual([])
  })

  it('leaves unfinished issues in the closed cycle when rollover is off', async () => {
    const { user, team, statusOf } = await arrange({ cycleRolloverUnfinished: false })
    await cyclesMaintain(deps, NOW)
    const [current] = await teamCycles(team.id)
    const todo = await createIssue(db, {
      teamId: team.id,
      creatorId: user.id,
      cycleId: current!.id,
      statusId: await statusOf('unstarted'),
    })
    await cyclesMaintain(deps, LATER)
    expect((await teamCycles(team.id))[0]!.completedAt).toEqual(LATER)
    expect(await cycleOf(db, todo.id)).toBe(current!.id)
    expect(published).toEqual([])
  })
})
