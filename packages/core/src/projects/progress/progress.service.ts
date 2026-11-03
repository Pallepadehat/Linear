import {
  issueLabels,
  issues,
  labels,
  projectProgressSnapshots,
  projects,
  users,
  workflowStatuses,
  type DbOrTx,
} from '@linear/db'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { DomainError } from '../../errors'
import { countProgress, progressBreakdown, progressSeries } from './rules'

/** Snapshots are filed under the UTC day they were taken (docs/domain.md → Project progress). */
function utcDay(now: Date) {
  return now.toISOString().slice(0, 10)
}

/** Each issue in the project with its status category and assignee. */
function projectIssues(db: DbOrTx, workspaceId: string, projectId: string) {
  return db
    .select({
      id: issues.id,
      category: workflowStatuses.category,
      assigneeId: issues.assigneeId,
      assigneeName: users.name,
    })
    .from(issues)
    .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .leftJoin(users, eq(users.id, issues.assigneeId))
    .where(and(eq(issues.workspaceId, workspaceId), eq(issues.projectId, projectId)))
}

/**
 * Upserts today's snapshot of the project's counts; running it twice on a day leaves one
 * row with the latest counts. Returns null when the project no longer exists.
 */
export async function snapshotProjectProgress(db: DbOrTx, projectId: string, now = new Date()) {
  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
  if (!project) return null
  const rows = await projectIssues(db, project.workspaceId, projectId)
  const counts = countProgress(rows.map((row) => row.category))
  const [snapshot] = await db
    .insert(projectProgressSnapshots)
    .values({ workspaceId: project.workspaceId, projectId, date: utcDay(now), ...counts })
    .onConflictDoUpdate({
      target: [projectProgressSnapshots.projectId, projectProgressSnapshots.date],
      set: { ...counts, updatedAt: sql`now()` },
    })
    .returning()
  return snapshot ?? null
}

/** Projects the daily snapshot covers: planned and in progress, in every workspace. */
export async function listActiveProjectIds(db: DbOrTx) {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.status, ['planned', 'in_progress']))
    .orderBy(asc(projects.id))
  return rows.map((row) => row.id)
}

/**
 * The Progress card: the daily series (stored snapshots plus today's live counts), today's
 * totals, and done / total per assignee and per issue label. A project outside the
 * workspace is NOT_FOUND.
 */
export async function getProjectProgress(
  db: DbOrTx,
  workspaceId: string,
  projectId: string,
  now = new Date(),
) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
  if (!project) throw new DomainError('NOT_FOUND', 'Project not found')

  const [rows, labelRows, snapshots] = await Promise.all([
    projectIssues(db, workspaceId, projectId),
    db
      .select({
        labelId: labels.id,
        name: labels.name,
        color: labels.color,
        category: workflowStatuses.category,
      })
      .from(issueLabels)
      .innerJoin(issues, eq(issues.id, issueLabels.issueId))
      .innerJoin(labels, eq(labels.id, issueLabels.labelId))
      .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
      .where(and(eq(issueLabels.workspaceId, workspaceId), eq(issues.projectId, projectId))),
    db
      .select({
        date: projectProgressSnapshots.date,
        scope: projectProgressSnapshots.scope,
        started: projectProgressSnapshots.started,
        completed: projectProgressSnapshots.completed,
      })
      .from(projectProgressSnapshots)
      .where(
        and(
          eq(projectProgressSnapshots.workspaceId, workspaceId),
          eq(projectProgressSnapshots.projectId, projectId),
        ),
      )
      .orderBy(asc(projectProgressSnapshots.date)),
  ])

  const totals = countProgress(rows.map((row) => row.category))
  return {
    series: progressSeries(snapshots, { date: utcDay(now), ...totals }),
    totals,
    byAssignee: progressBreakdown(
      rows.map((row) => ({
        group: { key: row.assigneeId, name: row.assigneeName ?? 'No assignee' },
        category: row.category,
      })),
    ).map(({ key, name, done, total }) => ({ userId: key, name, done, total })),
    byLabel: progressBreakdown(
      labelRows.map((row) => ({
        group: { key: row.labelId, name: row.name, color: row.color },
        category: row.category,
      })),
    ).map(({ key, name, color, done, total }) => ({ labelId: key, name, color, done, total })),
  }
}
