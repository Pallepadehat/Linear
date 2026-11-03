import { cycles, issues, teams, workflowStatuses, type DbOrTx } from '@linear/db'
import { and, asc, count, eq, gt, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm'
import { DomainError } from '../errors'
import {
  currentCycle,
  cycleDayIndex,
  nextCycleWindows,
  setSnapshotPoint,
  type CycleSettings,
} from './schedule'

type TeamRow = typeof teams.$inferSelect
export type CycleRow = typeof cycles.$inferSelect
export type CycleProgress = { scope: number; started: number; completed: number }
export type CycleRecord = CycleRow & { progress: CycleProgress }

export function cycleSettingsOf(team: TeamRow): CycleSettings {
  return {
    durationWeeks: team.cycleDurationWeeks,
    startWeekday: team.cycleStartWeekday,
    cooldownWeeks: team.cycleCooldownWeeks,
    upcomingCount: team.cycleUpcomingCount,
  }
}

/** Omitted fields are left unchanged. */
export type UpdateTeamCycleSettingsInput = {
  workspaceId: string
  teamId: string
  cyclesEnabled?: boolean
  cycleDurationWeeks?: number
  cycleStartWeekday?: number
  cycleCooldownWeeks?: number
  cycleUpcomingCount?: number
  cycleAutoAddStarted?: boolean
  cycleRolloverUnfinished?: boolean
}

const SETTING_RANGES = {
  cycleDurationWeeks: [1, 8],
  cycleStartWeekday: [0, 6],
  cycleCooldownWeeks: [0, 2],
  cycleUpcomingCount: [1, 6],
} as const

/**
 * Saves the team's cycle settings. Turning cycles on (or changing the schedule of a
 * team that has them on) schedules the missing cycles right away, so the team has a
 * current cycle without waiting for the hourly job. Existing cycles keep their dates.
 */
export async function updateTeamCycleSettings(
  db: DbOrTx,
  input: UpdateTeamCycleSettingsInput,
  now = new Date(),
) {
  const { workspaceId, teamId, ...settings } = input
  for (const [key, [min, max]] of Object.entries(SETTING_RANGES)) {
    const value = settings[key as keyof typeof SETTING_RANGES]
    if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) {
      throw new DomainError('BAD_REQUEST', `${key} must be between ${min} and ${max}`)
    }
  }
  return db.transaction(async (tx) => {
    const [team] = await tx
      .update(teams)
      .set({ ...settings, updatedAt: new Date() })
      .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
      .returning()
    if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
    if (team.cyclesEnabled) await scheduleCycles(tx, team, now)
    return team
  })
}

/** Creates the team's missing current/upcoming cycles. Idempotent. */
export async function scheduleCycles(db: DbOrTx, team: TeamRow, now: Date) {
  const existing = await db
    .select({ number: cycles.number, startsAt: cycles.startsAt, endsAt: cycles.endsAt })
    .from(cycles)
    .where(and(eq(cycles.workspaceId, team.workspaceId), eq(cycles.teamId, team.id)))
    .orderBy(asc(cycles.number))
  const last = existing.at(-1) ?? null
  const upcoming = existing.filter((c) => c.startsAt.getTime() > now.getTime()).length
  const windows = nextCycleWindows(cycleSettingsOf(team), last, now, upcoming)
  if (windows.length === 0) return []
  return db
    .insert(cycles)
    .values(windows.map((w) => ({ ...w, workspaceId: team.workspaceId, teamId: team.id })))
    .onConflictDoNothing({ target: [cycles.teamId, cycles.number] })
    .returning()
}

/** Scope (all but canceled), started and completed issue counts per cycle. */
async function progressOf(db: DbOrTx, workspaceId: string, cycleIds: string[]) {
  const progress = new Map<string, CycleProgress>()
  for (const id of cycleIds) progress.set(id, { scope: 0, started: 0, completed: 0 })
  if (cycleIds.length === 0) return progress
  const rows = await db
    .select({ cycleId: issues.cycleId, category: workflowStatuses.category, n: count() })
    .from(issues)
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .where(and(eq(issues.workspaceId, workspaceId), inArray(issues.cycleId, cycleIds)))
    .groupBy(issues.cycleId, workflowStatuses.category)
  for (const row of rows) {
    const entry = row.cycleId ? progress.get(row.cycleId) : undefined
    if (!entry || row.category === 'canceled') continue
    entry.scope += row.n
    if (row.category === 'started') entry.started += row.n
    if (row.category === 'completed') entry.completed += row.n
  }
  return progress
}

async function withProgress(db: DbOrTx, workspaceId: string, rows: CycleRow[]) {
  const progress = await progressOf(
    db,
    workspaceId,
    rows.map((row) => row.id),
  )
  return rows.map((row) => ({ ...row, progress: progress.get(row.id)! }))
}

/**
 * The team's cycles: the current one, then upcoming (soonest first), then past
 * (most recent first). A team in another workspace is `NOT_FOUND`.
 */
export async function listCycles(
  db: DbOrTx,
  workspaceId: string,
  teamId: string,
  now = new Date(),
): Promise<CycleRecord[]> {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
  if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
  const rows = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.workspaceId, workspaceId), eq(cycles.teamId, teamId)))
    .orderBy(asc(cycles.startsAt))
  const isPast = (c: CycleRow) => Boolean(c.completedAt) || c.endsAt.getTime() <= now.getTime()
  const current = currentCycle(rows, now)
  const upcoming = rows.filter((c) => c !== current && !isPast(c))
  const past = rows.filter((c) => c !== current && isPast(c)).reverse()
  return withProgress(db, workspaceId, [...(current ? [current] : []), ...upcoming, ...past])
}

export async function getCycle(db: DbOrTx, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.workspaceId, workspaceId), eq(cycles.id, id)))
  if (!row) throw new DomainError('NOT_FOUND', 'Cycle not found')
  const [record] = await withProgress(db, workspaceId, [row])
  return record!
}

/** Renames a cycle; a blank name clears it (the UI then shows "Cycle <number>"). */
export async function updateCycle(
  db: DbOrTx,
  input: { workspaceId: string; id: string; name?: string | null },
) {
  const changes: Partial<typeof cycles.$inferInsert> = { updatedAt: new Date() }
  if (input.name !== undefined) changes.name = input.name?.trim() || null
  const [row] = await db
    .update(cycles)
    .set(changes)
    .where(and(eq(cycles.workspaceId, input.workspaceId), eq(cycles.id, input.id)))
    .returning({ id: cycles.id })
  if (!row) throw new DomainError('NOT_FOUND', 'Cycle not found')
  return getCycle(db, input.workspaceId, row.id)
}

/**
 * Checks that an issue of `teamId` may be put in the cycle: same team and not
 * completed. Anything else (including a cycle id from another workspace) is
 * `BAD_REQUEST`, like other invalid issue properties.
 */
export async function assignCycle(
  db: DbOrTx,
  workspaceId: string,
  teamId: string,
  cycleId: string,
) {
  const [cycle] = await db
    .select({ id: cycles.id, teamId: cycles.teamId, completedAt: cycles.completedAt })
    .from(cycles)
    .where(and(eq(cycles.workspaceId, workspaceId), eq(cycles.id, cycleId)))
  if (!cycle || cycle.teamId !== teamId) {
    throw new DomainError('BAD_REQUEST', 'Cycle does not belong to this team')
  }
  if (cycle.completedAt) throw new DomainError('BAD_REQUEST', 'Cycle is already completed')
  return cycle.id
}

/**
 * The cycle an issue moved to a started status is added to (auto-add), or null
 * when the team has cycles or auto-add off, or no cycle is running.
 */
export async function autoAddCycleId(
  db: DbOrTx,
  workspaceId: string,
  teamId: string,
  now = new Date(),
) {
  const [team] = await db
    .select({ enabled: teams.cyclesEnabled, autoAdd: teams.cycleAutoAddStarted })
    .from(teams)
    .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
  if (!team?.enabled || !team.autoAdd) return null
  const [cycle] = await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(
      and(
        eq(cycles.workspaceId, workspaceId),
        eq(cycles.teamId, teamId),
        isNull(cycles.completedAt),
        lte(cycles.startsAt, now),
        gt(cycles.endsAt, now),
      ),
    )
    .limit(1)
  return cycle?.id ?? null
}

/** Teams the hourly `cycles-maintain` job looks after. */
export async function listCycleTeamIds(db: DbOrTx) {
  const rows = await db.select({ id: teams.id }).from(teams).where(eq(teams.cyclesEnabled, true))
  return rows.map((row) => row.id)
}

export type MaintainResult = {
  workspaceId: string
  created: number
  closed: number
  /** Issues rolled over into the next cycle, for realtime events. */
  movedIssueIds: string[]
}

/**
 * One maintenance pass for a team (docs/domain.md → Cycles): schedule missing
 * cycles, close ended ones (rolling unfinished issues into the next cycle when
 * enabled) and record today's scope/completed point for each open cycle. Every
 * step is idempotent, so reruns in the same hour change nothing but the snapshot
 * values. The team row lock serializes it with settings changes.
 */
export async function maintainTeamCycles(
  db: DbOrTx,
  teamId: string,
  now = new Date(),
): Promise<MaintainResult | null> {
  return db.transaction(async (tx) => {
    const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).for('update')
    if (!team?.cyclesEnabled) return null
    const { workspaceId } = team
    const created = await scheduleCycles(tx, team, now)

    const open = await tx
      .select()
      .from(cycles)
      .where(
        and(
          eq(cycles.workspaceId, workspaceId),
          eq(cycles.teamId, teamId),
          isNull(cycles.completedAt),
          lte(cycles.startsAt, now),
        ),
      )
      .orderBy(asc(cycles.number))

    const movedIssueIds: string[] = []
    let closed = 0
    for (const cycle of open) {
      const ended = cycle.endsAt.getTime() <= now.getTime()
      // A closed cycle's last point is taken before its unfinished issues move on.
      await recordSnapshot(tx, cycle, ended ? new Date(cycle.endsAt.getTime() - 1) : now)
      if (!ended) continue
      if (team.cycleRolloverUnfinished) {
        movedIssueIds.push(...(await rollOver(tx, cycle)))
      }
      await tx
        .update(cycles)
        .set({ completedAt: now, updatedAt: now })
        .where(eq(cycles.id, cycle.id))
      closed++
    }
    return { workspaceId, created: created.length, closed, movedIssueIds }
  })
}

async function recordSnapshot(tx: DbOrTx, cycle: CycleRow, at: Date) {
  const progress = (await progressOf(tx, cycle.workspaceId, [cycle.id])).get(cycle.id)!
  const day = cycleDayIndex(cycle, at)
  await tx
    .update(cycles)
    .set({
      scopeSnapshot: setSnapshotPoint(cycle.scopeSnapshot, day, progress.scope),
      completedSnapshot: setSnapshotPoint(cycle.completedSnapshot, day, progress.completed),
    })
    .where(eq(cycles.id, cycle.id))
}

/** Moves the cycle's unfinished issues into the team's next open cycle, if there is one. */
async function rollOver(tx: DbOrTx, cycle: CycleRow) {
  const [next] = await tx
    .select({ id: cycles.id })
    .from(cycles)
    .where(
      and(
        eq(cycles.workspaceId, cycle.workspaceId),
        eq(cycles.teamId, cycle.teamId),
        isNull(cycles.completedAt),
        gt(cycles.number, cycle.number),
      ),
    )
    .orderBy(asc(cycles.number))
    .limit(1)
  if (!next) return []
  const finished = tx
    .select({ id: workflowStatuses.id })
    .from(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.teamId, cycle.teamId),
        inArray(workflowStatuses.category, ['completed', 'canceled']),
      ),
    )
  const moved = await tx
    .update(issues)
    .set({ cycleId: next.id, updatedAt: sql`now()` })
    .where(
      and(
        eq(issues.workspaceId, cycle.workspaceId),
        eq(issues.cycleId, cycle.id),
        notInArray(issues.statusId, finished),
      ),
    )
    .returning({ id: issues.id })
  return moved.map((row) => row.id)
}
