import {
  projects,
  projectTeams,
  teams,
  uploads,
  issues,
  workflowStatuses,
  type DbOrTx,
} from '@linear/db'
import { and, asc, count, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { DomainError } from '../errors'
import { deleteFavoritesOf } from '../favorites/favorites.service'

type Changes = {
  name?: string
  description?: string | null
  status?: typeof projects.$inferInsert.status
  iconUploadId?: string | null
  teamIds?: string[]
}

/**
 * Issue counts per project: all linked issues in the total, only the `completed` status
 * category in the numerator (docs/domain.md → Projects).
 */
async function loadProgress(db: DbOrTx, workspaceId: string, projectId?: string) {
  const rows = await db
    .select({
      projectId: issues.projectId,
      total: count(),
      completed:
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
        projectId ? eq(issues.projectId, projectId) : isNotNull(issues.projectId),
      ),
    )
    .groupBy(issues.projectId)
  return new Map(
    rows.flatMap((row) =>
      row.projectId ? [[row.projectId, { completed: row.completed, total: row.total }]] : [],
    ),
  )
}

const NO_PROGRESS = { completed: 0, total: 0 }

export async function listProjects(db: DbOrTx, workspaceId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.name))
  const links = await db
    .select()
    .from(projectTeams)
    .where(eq(projectTeams.workspaceId, workspaceId))
  const progress = await loadProgress(db, workspaceId)
  return rows.map((row) => ({
    ...row,
    teamIds: links.filter((link) => link.projectId === row.id).map((link) => link.teamId),
    progress: progress.get(row.id) ?? NO_PROGRESS,
  }))
}

export async function getProject(db: DbOrTx, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)))
  if (!row) throw new DomainError('NOT_FOUND', 'Project not found')
  const links = await db
    .select()
    .from(projectTeams)
    .where(and(eq(projectTeams.workspaceId, workspaceId), eq(projectTeams.projectId, id)))
  const progress = await loadProgress(db, workspaceId, id)
  return {
    ...row,
    teamIds: links.map((link) => link.teamId),
    progress: progress.get(id) ?? NO_PROGRESS,
  }
}

async function saveProject(db: DbOrTx, workspaceId: string, input: Changes, id?: string) {
  return db.transaction(async (tx) => {
    if (id) {
      // Serialize team-set replacements so concurrent edits cannot combine their links.
      const [current] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)))
        .for('update')
      if (!current) throw new DomainError('NOT_FOUND', 'Project not found')
    }
    const { teamIds } = input
    const changes = {
      name: input.name,
      description: input.description,
      status: input.status,
      iconUploadId: input.iconUploadId,
    }
    if (changes.name !== undefined) {
      changes.name = changes.name.trim()
      if (!changes.name) throw new DomainError('BAD_REQUEST', 'Project name is required')
    }
    if (changes.iconUploadId) {
      const [icon] = await tx
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.id, changes.iconUploadId),
            eq(uploads.workspaceId, workspaceId),
            eq(uploads.kind, 'project_icon'),
            eq(uploads.status, 'ready'),
          ),
        )
      if (!icon)
        throw new DomainError(
          'BAD_REQUEST',
          'Project icon must be a ready project icon in this workspace',
        )
    }
    const uniqueTeams = teamIds === undefined ? undefined : [...new Set(teamIds)]
    if (uniqueTeams?.length) {
      const found = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.workspaceId, workspaceId), inArray(teams.id, uniqueTeams)))
      if (found.length !== uniqueTeams.length)
        throw new DomainError('BAD_REQUEST', 'Team not found')
    }
    const [row] = id
      ? await tx
          .update(projects)
          .set({ ...changes, updatedAt: new Date() })
          .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)))
          .returning()
      : await tx
          .insert(projects)
          .values({ ...changes, name: changes.name ?? '', workspaceId })
          .returning()
    if (!row) throw new DomainError('NOT_FOUND', 'Project not found')
    if (uniqueTeams !== undefined) {
      await tx
        .delete(projectTeams)
        .where(and(eq(projectTeams.workspaceId, workspaceId), eq(projectTeams.projectId, row.id)))
      if (uniqueTeams.length)
        await tx
          .insert(projectTeams)
          .values(uniqueTeams.map((teamId) => ({ workspaceId, projectId: row.id, teamId })))
    }
    return getProject(tx, workspaceId, row.id)
  })
}
export function createProject(db: DbOrTx, workspaceId: string, input: Changes & { name: string }) {
  return saveProject(db, workspaceId, input)
}
export function updateProject(db: DbOrTx, workspaceId: string, id: string, input: Changes) {
  return saveProject(db, workspaceId, input, id)
}
export async function deleteProject(db: DbOrTx, workspaceId: string, id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)))
      .returning({ id: projects.id })
    if (!row) throw new DomainError('NOT_FOUND', 'Project not found')
    await deleteFavoritesOf(tx, workspaceId, 'project', [row.id])
    return row
  })
}
