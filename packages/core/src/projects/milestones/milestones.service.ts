import { issues, projectMilestones, projects, workflowStatuses, type DbOrTx } from '@linear/db'
import { and, asc, count, eq, inArray, isNotNull, max, sql } from 'drizzle-orm'
import type { ActivityActor } from '../../activity/activity.service'
import { recordProjectActivity } from '../../activity/project-activity.service'
import { DomainError, isUniqueViolation } from '../../errors'
import { assertProjectDates } from '../project-rules'
import {
  assertMilestoneInProject,
  completesMilestone,
  currentMilestoneOf,
  isMilestoneComplete,
  mergeMilestoneOrder,
  milestoneProgress,
  type MilestoneCounts,
} from './rules'

export type MilestoneRow = typeof projectMilestones.$inferSelect
export type MilestoneRecord = MilestoneRow &
  MilestoneCounts & { progress: number; isComplete: boolean }

type MilestoneFields = {
  name?: string
  description?: string | null
  targetDate?: string | null
}

const inWorkspace = (workspaceId: string) => eq(projectMilestones.workspaceId, workspaceId)

/** Issue counts per milestone, for the given projects (or the whole workspace). */
async function loadCounts(db: DbOrTx, workspaceId: string, projectIds?: string[]) {
  const rows = await db
    .select({
      milestoneId: issues.milestoneId,
      issueCount: count(),
      doneCount:
        sql<number>`count(*) filter (where ${workflowStatuses.category} = 'completed')`.mapWith(
          Number,
        ),
    })
    .from(issues)
    .innerJoin(
      workflowStatuses,
      and(eq(workflowStatuses.id, issues.statusId), eq(workflowStatuses.workspaceId, workspaceId)),
    )
    .where(
      and(
        eq(issues.workspaceId, workspaceId),
        isNotNull(issues.milestoneId),
        projectIds ? inArray(issues.projectId, projectIds) : undefined,
      ),
    )
    .groupBy(issues.milestoneId)
  return new Map(rows.flatMap((row) => (row.milestoneId ? [[row.milestoneId, row]] : [])))
}

async function withCounts(
  db: DbOrTx,
  workspaceId: string,
  rows: MilestoneRow[],
  projectIds?: string[],
): Promise<MilestoneRecord[]> {
  const counts = rows.length ? await loadCounts(db, workspaceId, projectIds) : new Map()
  return rows.map((row) => {
    const { issueCount = 0, doneCount = 0 } = counts.get(row.id) ?? {}
    const tally = { issueCount, doneCount }
    return {
      ...row,
      ...tally,
      progress: milestoneProgress(tally),
      isComplete: isMilestoneComplete(tally),
    }
  })
}

const ordered = [asc(projectMilestones.sortOrder), asc(projectMilestones.createdAt)]

async function assertProjectExists(db: DbOrTx, workspaceId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
  if (!project) throw new DomainError('NOT_FOUND', 'Project not found')
}

/** The project's milestones in their order, each with its issue counts and progress. */
export async function listMilestones(db: DbOrTx, workspaceId: string, projectId: string) {
  await assertProjectExists(db, workspaceId, projectId)
  const rows = await db
    .select()
    .from(projectMilestones)
    .where(and(inWorkspace(workspaceId), eq(projectMilestones.projectId, projectId)))
    .orderBy(...ordered)
  return withCounts(db, workspaceId, rows, [projectId])
}

export async function getMilestone(db: DbOrTx, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(projectMilestones)
    .where(and(inWorkspace(workspaceId), eq(projectMilestones.id, id)))
  if (!row) throw new DomainError('NOT_FOUND', 'Milestone not found')
  const [record] = await withCounts(db, workspaceId, [row], [row.projectId])
  return record!
}

/** Each project's current milestone (first not complete), for the projects list. */
export async function currentMilestones(db: DbOrTx, workspaceId: string, projectIds?: string[]) {
  const rows = await db
    .select()
    .from(projectMilestones)
    .where(
      and(
        inWorkspace(workspaceId),
        projectIds ? inArray(projectMilestones.projectId, projectIds) : undefined,
      ),
    )
    .orderBy(...ordered)
  const byProject = new Map<string, MilestoneRecord[]>()
  for (const record of await withCounts(db, workspaceId, rows, projectIds)) {
    const list = byProject.get(record.projectId) ?? []
    list.push(record)
    byProject.set(record.projectId, list)
  }
  return new Map([...byProject].map(([projectId, list]) => [projectId, currentMilestoneOf(list)]))
}

function normalize(fields: MilestoneFields) {
  const name = fields.name?.trim()
  if (name !== undefined && !name)
    throw new DomainError('BAD_REQUEST', 'Milestone name is required')
  if (fields.targetDate) assertProjectDates(null, fields.targetDate)
  return { name, description: fields.description, targetDate: fields.targetDate }
}

/** Runs a write in a savepoint so a duplicate name doesn't abort an outer transaction. */
async function saving<T>(db: DbOrTx, name: string | undefined, write: (tx: DbOrTx) => Promise<T>) {
  try {
    return await db.transaction(write)
  } catch (error) {
    if (isUniqueViolation(error, 'project_milestones_project_id_name_unique'))
      throw new DomainError('CONFLICT', `A milestone named "${name}" already exists`)
    throw error
  }
}

/**
 * Adds a milestone at the end of the project's order and writes `milestone.created` to the
 * project's feed. Names are unique per project.
 */
export async function createMilestone(
  db: DbOrTx,
  workspaceId: string,
  input: MilestoneFields & { projectId: string; name: string },
  actor: ActivityActor,
) {
  const fields = normalize(input)
  await assertProjectExists(db, workspaceId, input.projectId)
  const row = await saving(db, fields.name, async (tx) => {
    // Locks the project so concurrent creates get distinct positions.
    await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, input.projectId)))
      .for('update')
    const [last] = await tx
      .select({ sortOrder: max(projectMilestones.sortOrder) })
      .from(projectMilestones)
      .where(and(inWorkspace(workspaceId), eq(projectMilestones.projectId, input.projectId)))
    const [inserted] = await tx
      .insert(projectMilestones)
      .values({
        workspaceId,
        projectId: input.projectId,
        name: fields.name!,
        description: fields.description ?? null,
        targetDate: fields.targetDate ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      })
      .returning()
    if (!inserted) throw new Error('milestone insert returned no row')
    await recordProjectActivity(tx, {
      workspaceId,
      projectId: input.projectId,
      actor,
      events: [
        { kind: 'milestone.created', payload: { milestoneId: inserted.id, name: inserted.name } },
      ],
    })
    return inserted
  })
  return getMilestone(db, workspaceId, row.id)
}

/** Omitted fields are left unchanged. */
export async function updateMilestone(
  db: DbOrTx,
  workspaceId: string,
  id: string,
  input: MilestoneFields,
) {
  const fields = normalize(input)
  const [row] = await saving(db, fields.name, (tx) =>
    tx
      .update(projectMilestones)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(inWorkspace(workspaceId), eq(projectMilestones.id, id)))
      .returning({ id: projectMilestones.id }),
  )
  if (!row) throw new DomainError('NOT_FOUND', 'Milestone not found')
  return getMilestone(db, workspaceId, row.id)
}

/** Issues keep their project and lose the milestone (`ON DELETE SET NULL`). */
export async function deleteMilestone(db: DbOrTx, workspaceId: string, id: string) {
  return db.transaction(async (tx) => {
    const affected = await tx
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.workspaceId, workspaceId), eq(issues.milestoneId, id)))
    const [row] = await tx
      .delete(projectMilestones)
      .where(and(inWorkspace(workspaceId), eq(projectMilestones.id, id)))
      .returning({ id: projectMilestones.id, projectId: projectMilestones.projectId })
    if (!row) throw new DomainError('NOT_FOUND', 'Milestone not found')
    return { ...row, issueIds: affected.map((issue) => issue.id) }
  })
}

/**
 * Moves `orderedIds` to the front in that order; milestones the request doesn't mention keep
 * their relative order after them. An id that isn't one of the project's milestones is NOT_FOUND.
 */
export async function reorderMilestones(
  db: DbOrTx,
  workspaceId: string,
  projectId: string,
  orderedIds: string[],
) {
  await assertProjectExists(db, workspaceId, projectId)
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: projectMilestones.id })
      .from(projectMilestones)
      .where(and(inWorkspace(workspaceId), eq(projectMilestones.projectId, projectId)))
      .orderBy(...ordered)
      .for('update')
    const order = mergeMilestoneOrder(
      current.map((row) => row.id),
      orderedIds,
    )
    if (!order) throw new DomainError('NOT_FOUND', 'Milestone not found')
    for (const [sortOrder, id] of order.entries()) {
      await tx
        .update(projectMilestones)
        .set({ sortOrder })
        .where(and(inWorkspace(workspaceId), eq(projectMilestones.id, id)))
    }
  })
  return listMilestones(db, workspaceId, projectId)
}

/** Checks that the milestone belongs to `projectId` (the issue's project) in this workspace. */
export async function assertIssueMilestone(
  db: DbOrTx,
  workspaceId: string,
  milestoneId: string,
  projectId: string | null,
) {
  const [milestone] = await db
    .select({ projectId: projectMilestones.projectId })
    .from(projectMilestones)
    .where(and(inWorkspace(workspaceId), eq(projectMilestones.id, milestoneId)))
  assertMilestoneInProject(milestone, projectId)
}

/**
 * Writes `milestone.completed` when this issue change moved the milestone's last open issue
 * to done (`completesMilestone`). Call inside the issue's transaction, after the update. The
 * milestone row is locked before counting, so when two last issues finish at once the second
 * transaction waits, sees the first one's change and writes the single entry. Returns the
 * project whose feed got the entry, or null.
 */
export async function recordMilestoneCompletion(
  tx: DbOrTx,
  workspaceId: string,
  milestoneId: string,
  actor: ActivityActor,
  issue: { wasDone: boolean; isDone: boolean },
) {
  if (!issue.isDone || issue.wasDone) return null
  const [locked] = await tx
    .select({ id: projectMilestones.id })
    .from(projectMilestones)
    .where(and(inWorkspace(workspaceId), eq(projectMilestones.id, milestoneId)))
    .for('update')
  if (!locked) return null
  const milestone = await getMilestone(tx, workspaceId, locked.id)
  if (!completesMilestone(milestone, issue)) return null
  await recordProjectActivity(tx, {
    workspaceId,
    projectId: milestone.projectId,
    actor,
    events: [
      { kind: 'milestone.completed', payload: { milestoneId: milestone.id, name: milestone.name } },
    ],
  })
  return milestone.projectId
}
