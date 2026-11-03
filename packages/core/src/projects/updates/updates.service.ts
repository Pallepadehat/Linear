import { projectActivity, projectUpdates, projects, users, type DbOrTx } from '@linear/db'
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { recordProjectActivity } from '../../activity/project-activity.service'
import { assertCursor } from '../../cursor'
import { DomainError } from '../../errors'
import { healthByProject, type ProjectHealthValue } from './rules'

const columns = {
  id: projectUpdates.id,
  projectId: projectUpdates.projectId,
  authorId: projectUpdates.authorId,
  authorName: users.name,
  authorAvatarUploadId: users.avatarUploadId,
  health: projectUpdates.health,
  body: projectUpdates.body,
  createdAt: projectUpdates.createdAt,
  updatedAt: projectUpdates.updatedAt,
}

export type ProjectUpdateRecord = {
  id: string
  projectId: string
  authorId: string
  authorName: string
  authorAvatarUploadId: string | null
  health: ProjectHealthValue
  body: string
  createdAt: Date
  updatedAt: Date
}

const inWorkspace = (workspaceId: string) => eq(projectUpdates.workspaceId, workspaceId)

function selectUpdates(db: DbOrTx, where: SQL | undefined) {
  return db
    .select(columns)
    .from(projectUpdates)
    .innerJoin(users, eq(users.id, projectUpdates.authorId))
    .where(where)
}

function normalizeBody(body: string) {
  const trimmed = body.trim()
  if (!trimmed) throw new DomainError('BAD_REQUEST', 'Update cannot be empty')
  return trimmed
}

async function assertProject(db: DbOrTx, workspaceId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId)))
  if (!project) throw new DomainError('NOT_FOUND', 'Project not found')
}

async function getProjectUpdate(db: DbOrTx, workspaceId: string, id: string) {
  const [record] = await selectUpdates(db, and(inWorkspace(workspaceId), eq(projectUpdates.id, id)))
  if (!record) throw new DomainError('NOT_FOUND', 'Update not found')
  return record
}

export type ListProjectUpdatesInput = {
  workspaceId: string
  projectId: string
  cursor?: string | null
  limit: number
}

/**
 * Newest first by `(createdAt, id)`, matching the `(projectId, createdAt)` index. The
 * cursor is the last id of the previous page; an id that isn't one of this project's
 * updates (deleted meanwhile, or foreign) is `BAD_REQUEST`.
 */
export async function listProjectUpdates(db: DbOrTx, input: ListProjectUpdatesInput) {
  assertCursor(input.cursor)
  await assertProject(db, input.workspaceId, input.projectId)
  const scope = and(inWorkspace(input.workspaceId), eq(projectUpdates.projectId, input.projectId))

  let after: SQL | undefined
  if (input.cursor) {
    const [cursor] = await db
      .select({ id: projectUpdates.id })
      .from(projectUpdates)
      .where(and(scope, eq(projectUpdates.id, input.cursor)))
    if (!cursor) throw new DomainError('BAD_REQUEST', 'Invalid cursor')
    // Compared in SQL: timestamps keep microseconds, a JS Date only milliseconds, so a
    // round-tripped value would skip updates posted in the cursor's millisecond.
    after = sql`(${projectUpdates.createdAt}, ${projectUpdates.id}) < (select ${projectUpdates.createdAt}, ${projectUpdates.id} from ${projectUpdates} where ${projectUpdates.id} = ${cursor.id})`
  }

  const rows = await selectUpdates(db, and(scope, after))
    .orderBy(desc(projectUpdates.createdAt), desc(projectUpdates.id))
    .limit(input.limit + 1)
  const items = rows.slice(0, input.limit)
  const nextCursor = rows.length > input.limit ? (items.at(-1)?.id ?? null) : null
  return { items, nextCursor }
}

export type CreateProjectUpdateInput = {
  workspaceId: string
  projectId: string
  authorId: string
  health: ProjectHealthValue
  body: string
}

/** Posts an update (setting the project's health) and its `project_update.posted` entry. */
export async function createProjectUpdate(db: DbOrTx, input: CreateProjectUpdateInput) {
  const body = normalizeBody(input.body)
  const id = await db.transaction(async (tx) => {
    await assertProject(tx, input.workspaceId, input.projectId)
    const [row] = await tx
      .insert(projectUpdates)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        authorId: input.authorId,
        health: input.health,
        body,
      })
      .returning({ id: projectUpdates.id })
    if (!row) throw new Error('project update insert returned no row')
    await recordProjectActivity(tx, {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      actor: { type: 'user', id: input.authorId },
      events: [{ kind: 'project_update.posted', payload: { updateId: row.id } }],
    })
    return row.id
  })
  return getProjectUpdate(db, input.workspaceId, id)
}

export type UpdateProjectUpdateInput = {
  workspaceId: string
  id: string
  /** Only the author may edit (owners included get `FORBIDDEN`). */
  userId: string
  health?: ProjectHealthValue
  body?: string
}

export async function updateProjectUpdate(db: DbOrTx, input: UpdateProjectUpdateInput) {
  const body = input.body === undefined ? undefined : normalizeBody(input.body)
  const existing = await getProjectUpdate(db, input.workspaceId, input.id)
  if (existing.authorId !== input.userId) {
    throw new DomainError('FORBIDDEN', 'You can only edit your own updates')
  }
  const changes = {
    ...(body !== undefined && body !== existing.body ? { body } : {}),
    ...(input.health !== undefined && input.health !== existing.health
      ? { health: input.health }
      : {}),
  }
  if (Object.keys(changes).length === 0) return existing
  await db
    .update(projectUpdates)
    .set(changes)
    .where(and(inWorkspace(input.workspaceId), eq(projectUpdates.id, existing.id)))
  return getProjectUpdate(db, input.workspaceId, existing.id)
}

export type DeleteProjectUpdateInput = {
  workspaceId: string
  id: string
  userId: string
  /** Workspace owners may delete anyone's update (docs/domain.md → Roles). */
  canDeleteOthers: boolean
}

/** Removes the update and its `project_update.posted` entry, so the feed doesn't point at nothing. */
export async function deleteProjectUpdate(db: DbOrTx, input: DeleteProjectUpdateInput) {
  const existing = await getProjectUpdate(db, input.workspaceId, input.id)
  if (existing.authorId !== input.userId && !input.canDeleteOthers) {
    throw new DomainError('FORBIDDEN', "You can't delete other people's updates")
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(projectActivity)
      .where(
        and(
          eq(projectActivity.workspaceId, input.workspaceId),
          eq(projectActivity.projectId, existing.projectId),
          eq(projectActivity.kind, 'project_update.posted'),
          sql`${projectActivity.payload}->>'updateId' = ${existing.id}`,
        ),
      )
    await tx
      .delete(projectUpdates)
      .where(and(inWorkspace(input.workspaceId), eq(projectUpdates.id, existing.id)))
  })
  return { id: existing.id, projectId: existing.projectId }
}

/**
 * Health per project in one query (the latest update of each, via `distinct on`), so
 * `projects.list` has no per-project lookups. Projects without updates are absent.
 */
export async function loadProjectHealth(db: DbOrTx, workspaceId: string, projectIds?: string[]) {
  const latest = await db
    .selectDistinctOn([projectUpdates.projectId], {
      id: projectUpdates.id,
      projectId: projectUpdates.projectId,
      health: projectUpdates.health,
      createdAt: projectUpdates.createdAt,
    })
    .from(projectUpdates)
    .where(
      and(
        inWorkspace(workspaceId),
        projectIds ? inArray(projectUpdates.projectId, projectIds) : undefined,
      ),
    )
    .orderBy(projectUpdates.projectId, desc(projectUpdates.createdAt), desc(projectUpdates.id))
  return healthByProject(latest)
}
