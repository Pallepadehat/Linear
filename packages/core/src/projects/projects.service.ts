import {
  projects,
  projectLabelAssignments,
  projectLabels,
  projectMembers,
  projectTeams,
  teams,
  uploads,
  issues,
  workflowStatuses,
  workspaceMembers,
  type DbOrTx,
} from '@linear/db'
import { and, asc, count, eq, inArray, isNotNull, sql, type AnyColumn } from 'drizzle-orm'
import { DomainError, isUniqueViolation } from '../errors'
import { assertProjectDates, assertProjectPriority } from './project-rules'
import { deleteFavoritesOf } from '../favorites/favorites.service'
import type { ActivityActor } from '../activity/activity.service'
import { recordProjectActivity } from '../activity/project-activity.service'
import { diffProject, type ProjectSnapshot } from '../activity/project-diff'

type Changes = {
  name?: string
  description?: string | null
  status?: typeof projects.$inferInsert.status
  iconUploadId?: string | null
  teamIds?: string[]
  priority?: number
  leadId?: string | null
  memberIds?: string[]
  startDate?: string | null
  targetDate?: string | null
  labelIds?: string[]
}

type Links = { teamIds: string[]; memberIds: string[]; labelIds: string[] }

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

/** Team, member and label ids per project, for one project or the whole workspace. */
async function loadLinks(db: DbOrTx, workspaceId: string, projectId?: string) {
  const scope = (table: { workspaceId: AnyColumn; projectId: AnyColumn }) =>
    and(eq(table.workspaceId, workspaceId), projectId ? eq(table.projectId, projectId) : undefined)
  const [teamRows, memberRows, labelRows] = await Promise.all([
    db
      .select({ projectId: projectTeams.projectId, id: projectTeams.teamId })
      .from(projectTeams)
      .where(scope(projectTeams)),
    db
      .select({ projectId: projectMembers.projectId, id: projectMembers.userId })
      .from(projectMembers)
      .where(scope(projectMembers))
      .orderBy(asc(projectMembers.createdAt), asc(projectMembers.id)),
    db
      .select({ projectId: projectLabelAssignments.projectId, id: projectLabelAssignments.labelId })
      .from(projectLabelAssignments)
      .where(scope(projectLabelAssignments)),
  ])
  const links = new Map<string, Links>()
  const entry = (id: string) => {
    let value = links.get(id)
    if (!value) links.set(id, (value = { teamIds: [], memberIds: [], labelIds: [] }))
    return value
  }
  for (const row of teamRows) entry(row.projectId).teamIds.push(row.id)
  for (const row of memberRows) entry(row.projectId).memberIds.push(row.id)
  for (const row of labelRows) entry(row.projectId).labelIds.push(row.id)
  return links
}

function withDetails(
  row: typeof projects.$inferSelect,
  links: Map<string, Links>,
  progress: Map<string, { completed: number; total: number }>,
) {
  const counts = progress.get(row.id) ?? NO_PROGRESS
  return {
    ...row,
    ...(links.get(row.id) ?? { teamIds: [], memberIds: [], labelIds: [] }),
    progress: counts,
    issueCount: counts.total,
  }
}

export async function listProjects(db: DbOrTx, workspaceId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(asc(projects.name))
  const links = await loadLinks(db, workspaceId)
  const progress = await loadProgress(db, workspaceId)
  return rows.map((row) => withDetails(row, links, progress))
}

export async function getProject(db: DbOrTx, workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)))
  if (!row) throw new DomainError('NOT_FOUND', 'Project not found')
  const links = await loadLinks(db, workspaceId, id)
  const progress = await loadProgress(db, workspaceId, id)
  return withDetails(row, links, progress)
}

/** Users must be members of the workspace; anyone else is NOT_FOUND, like a missing id. */
async function assertMembers(db: DbOrTx, workspaceId: string, userIds: string[]) {
  if (!userIds.length) return
  const found = await db
    .select({ id: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.userId, userIds)),
    )
  if (found.length !== userIds.length) throw new DomainError('NOT_FOUND', 'User not found')
}

async function assertLabels(db: DbOrTx, workspaceId: string, labelIds: string[]) {
  if (!labelIds.length) return
  const found = await db
    .select({ id: projectLabels.id })
    .from(projectLabels)
    .where(and(eq(projectLabels.workspaceId, workspaceId), inArray(projectLabels.id, labelIds)))
  if (found.length !== labelIds.length)
    throw new DomainError('NOT_FOUND', 'Project label not found')
}

async function saveProject(
  db: DbOrTx,
  workspaceId: string,
  actor: ActivityActor,
  input: Changes,
  id?: string,
) {
  return db.transaction(async (tx) => {
    let current: ProjectSnapshot | undefined
    if (id) {
      // Serialize link-set replacements so concurrent edits cannot combine their links.
      ;[current] = await tx
        .select({
          status: projects.status,
          priority: projects.priority,
          leadId: projects.leadId,
          startDate: projects.startDate,
          targetDate: projects.targetDate,
        })
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
      priority: input.priority,
      leadId: input.leadId,
      startDate: input.startDate,
      targetDate: input.targetDate,
    }
    if (changes.priority !== undefined) assertProjectPriority(changes.priority)
    // A partial update is checked against the stored date it leaves unchanged.
    assertProjectDates(
      changes.startDate === undefined ? (current?.startDate ?? null) : changes.startDate,
      changes.targetDate === undefined ? (current?.targetDate ?? null) : changes.targetDate,
    )
    const memberIds = input.memberIds === undefined ? undefined : [...new Set(input.memberIds)]
    const labelIds = input.labelIds === undefined ? undefined : [...new Set(input.labelIds)]
    await assertMembers(tx, workspaceId, [
      ...new Set([...(changes.leadId ? [changes.leadId] : []), ...(memberIds ?? [])]),
    ])
    if (labelIds) await assertLabels(tx, workspaceId, labelIds)
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
    // Each set is replaced only when the input supplies it.
    const projectId = row.id
    if (uniqueTeams !== undefined) {
      await tx
        .delete(projectTeams)
        .where(
          and(eq(projectTeams.workspaceId, workspaceId), eq(projectTeams.projectId, projectId)),
        )
      if (uniqueTeams.length)
        await tx
          .insert(projectTeams)
          .values(uniqueTeams.map((teamId) => ({ workspaceId, projectId, teamId })))
    }
    if (memberIds !== undefined) {
      await tx
        .delete(projectMembers)
        .where(
          and(eq(projectMembers.workspaceId, workspaceId), eq(projectMembers.projectId, projectId)),
        )
      if (memberIds.length)
        await tx
          .insert(projectMembers)
          .values(memberIds.map((userId) => ({ workspaceId, projectId, userId })))
    }
    if (labelIds !== undefined) {
      await tx
        .delete(projectLabelAssignments)
        .where(
          and(
            eq(projectLabelAssignments.workspaceId, workspaceId),
            eq(projectLabelAssignments.projectId, projectId),
          ),
        )
      if (labelIds.length)
        await tx
          .insert(projectLabelAssignments)
          .values(labelIds.map((labelId) => ({ workspaceId, projectId, labelId })))
    }
    await recordProjectActivity(tx, {
      workspaceId,
      projectId,
      actor,
      events: current ? diffProject(current, changes) : [{ kind: 'project.created', payload: {} }],
    })
    return getProject(tx, workspaceId, row.id)
  })
}
export function createProject(
  db: DbOrTx,
  workspaceId: string,
  input: Changes & { name: string },
  actor: ActivityActor,
) {
  return saveProject(db, workspaceId, actor, input)
}
export function updateProject(
  db: DbOrTx,
  workspaceId: string,
  id: string,
  input: Changes,
  actor: ActivityActor,
) {
  return saveProject(db, workspaceId, actor, input, id)
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

function duplicateLabelName(error: unknown, name: string): never {
  if (isUniqueViolation(error, 'project_labels_workspace_id_name_unique'))
    throw new DomainError('CONFLICT', `A project label named "${name}" already exists`)
  throw error
}

export function listProjectLabels(db: DbOrTx, workspaceId: string) {
  return db
    .select()
    .from(projectLabels)
    .where(eq(projectLabels.workspaceId, workspaceId))
    .orderBy(asc(projectLabels.name))
}

export async function createProjectLabel(
  db: DbOrTx,
  workspaceId: string,
  input: { name: string; color: string },
) {
  const name = input.name.trim()
  if (!name) throw new DomainError('BAD_REQUEST', 'Label name is required')
  const color = input.color.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(color))
    throw new DomainError('BAD_REQUEST', 'Label color must be a hex color like #5e6ad2')
  try {
    // A savepoint keeps a duplicate-name failure from aborting an outer transaction.
    return await db.transaction(async (tx) => {
      const [label] = await tx
        .insert(projectLabels)
        .values({ workspaceId, name, color })
        .returning()
      if (!label) throw new Error('project label insert returned no row')
      return label
    })
  } catch (error) {
    duplicateLabelName(error, name)
  }
}
