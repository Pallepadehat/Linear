import {
  cycles,
  labels,
  projects,
  teams,
  users,
  views,
  workflowStatuses,
  workspaceMembers,
  type DbOrTx,
} from '@linear/db'
import { and, asc, eq, inArray, or, type SQL } from 'drizzle-orm'
import { DomainError } from '../errors'
import { deleteFavoritesOf } from '../favorites/favorites.service'
import type { WorkspaceRole } from '../workspaces/workspaces.service'
import { collectFilterRefs, type FilterRefKind } from './filter-refs'

/** Who is asking; visibility and edit rights depend on both (docs/domain.md → Views). */
export type ViewActor = { workspaceId: string; userId: string; role: WorkspaceRole }

/** Already validated against the contract's view schemas. */
type ViewFields = {
  name?: string
  icon?: string
  color?: string
  filters?: Record<string, unknown>
  display?: Record<string, unknown>
  shared?: boolean
}

export type CreateViewInput = ViewFields & {
  name: string
  icon: string
  color: string
  filters: Record<string, unknown>
  display: Record<string, unknown>
  /** `null` or omitted = workspace view. */
  teamId?: string | null
}

export type UpdateViewInput = ViewFields & { id: string }

const NOT_FOUND = 'View not found'

/** Shared views plus the actor's private ones, in the actor's workspace. */
const visibleTo = (actor: ViewActor) =>
  and(
    eq(views.workspaceId, actor.workspaceId),
    or(eq(views.shared, true), eq(views.ownerId, actor.userId)),
  )

async function loadViews(db: DbOrTx, actor: ViewActor, where: SQL | undefined) {
  const rows = await db
    .select({
      view: views,
      owner: { id: users.id, name: users.name, avatarUploadId: users.avatarUploadId },
    })
    .from(views)
    .innerJoin(users, eq(users.id, views.ownerId))
    .where(and(visibleTo(actor), where))
    .orderBy(asc(views.name), asc(views.createdAt))
  return rows.map(({ view, owner }) => ({ ...view, owner }))
}

export type ViewRecord = Awaited<ReturnType<typeof loadViews>>[number]

/** Only that team's views with `teamId`; otherwise every view (workspace and team views). */
export function listViews(db: DbOrTx, actor: ViewActor, teamId?: string) {
  return loadViews(db, actor, teamId ? eq(views.teamId, teamId) : undefined)
}

/** NOT_FOUND for another workspace's view and for someone else's private view. */
export async function getView(db: DbOrTx, actor: ViewActor, id: string) {
  const [view] = await loadViews(db, actor, eq(views.id, id))
  if (!view) throw new DomainError('NOT_FOUND', NOT_FOUND)
  return view
}

/** A shared view can be changed only by its owner or a workspace owner. */
export function canEditView(actor: ViewActor, view: { ownerId: string; shared: boolean }) {
  return !view.shared || view.ownerId === actor.userId || actor.role === 'owner'
}

async function editableView(db: DbOrTx, actor: ViewActor, id: string) {
  const view = await getView(db, actor, id)
  if (!canEditView(actor, view)) {
    throw new DomainError('FORBIDDEN', 'Only the view’s owner or a workspace owner can change it')
  }
  return view
}

/** Any member can create a view. */
export async function createView(db: DbOrTx, actor: ViewActor, input: CreateViewInput) {
  const teamId = input.teamId ?? null
  if (teamId) await assertTeam(db, actor.workspaceId, teamId)
  await assertFilterRefs(db, actor.workspaceId, input.filters)
  const [row] = await db
    .insert(views)
    .values({
      workspaceId: actor.workspaceId,
      teamId,
      ownerId: actor.userId,
      name: normalizeName(input.name),
      icon: input.icon,
      color: input.color,
      filters: input.filters,
      display: input.display,
      shared: input.shared ?? true,
    })
    .returning({ id: views.id })
  if (!row) throw new Error('view insert returned no row')
  return getView(db, actor, row.id)
}

export async function updateView(db: DbOrTx, actor: ViewActor, input: UpdateViewInput) {
  await editableView(db, actor, input.id)
  if (input.filters) await assertFilterRefs(db, actor.workspaceId, input.filters)
  await db
    .update(views)
    .set({
      name: input.name === undefined ? undefined : normalizeName(input.name),
      icon: input.icon,
      color: input.color,
      filters: input.filters,
      display: input.display,
      shared: input.shared,
    })
    .where(and(eq(views.workspaceId, actor.workspaceId), eq(views.id, input.id)))
  return getView(db, actor, input.id)
}

/** Deletes the view and every user's favorite of it. */
export async function deleteView(db: DbOrTx, actor: ViewActor, id: string) {
  await editableView(db, actor, id)
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(views)
      .where(and(eq(views.workspaceId, actor.workspaceId), eq(views.id, id)))
      .returning({ id: views.id })
    if (!deleted) throw new DomainError('NOT_FOUND', NOT_FOUND)
    await deleteFavoritesOf(tx, actor.workspaceId, 'view', [id])
    return deleted
  })
}

function normalizeName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new DomainError('BAD_REQUEST', 'View name is required')
  return trimmed
}

async function assertTeam(db: DbOrTx, workspaceId: string, teamId: string) {
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.workspaceId, workspaceId), eq(teams.id, teamId)))
  if (!team) throw new DomainError('NOT_FOUND', 'Team not found')
}

const LABELS: Record<FilterRefKind, string> = {
  status: 'Status',
  member: 'User',
  project: 'Project',
  cycle: 'Cycle',
  label: 'Label',
}

/** Every id inside the filters belongs to the workspace (NOT_FOUND, so ids can't be probed). */
async function assertFilterRefs(db: DbOrTx, workspaceId: string, filters: Record<string, unknown>) {
  const refs = collectFilterRefs(filters)
  const found = async (kind: FilterRefKind, ids: string[]) => {
    switch (kind) {
      case 'status':
        return db
          .select({ id: workflowStatuses.id })
          .from(workflowStatuses)
          .where(
            and(eq(workflowStatuses.workspaceId, workspaceId), inArray(workflowStatuses.id, ids)),
          )
      case 'member':
        return db
          .select({ id: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              inArray(workspaceMembers.userId, ids),
            ),
          )
      case 'project':
        return db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.id, ids)))
      case 'cycle':
        return db
          .select({ id: cycles.id })
          .from(cycles)
          .where(and(eq(cycles.workspaceId, workspaceId), inArray(cycles.id, ids)))
      case 'label':
        return db
          .select({ id: labels.id })
          .from(labels)
          .where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, ids)))
    }
  }
  for (const kind of Object.keys(refs) as FilterRefKind[]) {
    const ids = refs[kind]
    if (ids.length === 0) continue
    if ((await found(kind, ids)).length !== ids.length) {
      throw new DomainError('NOT_FOUND', `${LABELS[kind]} not found`)
    }
  }
}
