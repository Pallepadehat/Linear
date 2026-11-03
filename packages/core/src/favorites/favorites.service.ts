import {
  favorites,
  issues,
  projects,
  teams,
  workflowStatuses,
  type DbOrTx,
  type StatusCategory,
} from '@linear/db'
import type { favoriteEntityType } from '@linear/db'
import { and, asc, eq, inArray, max } from 'drizzle-orm'
import { DomainError } from '../errors'
import { mergeFavoriteOrder } from './reorder'

export type FavoriteEntityType = (typeof favoriteEntityType.enumValues)[number]

/** Whose favorites, in which workspace; every query filters by both. */
export type FavoriteOwner = { workspaceId: string; userId: string }

const ownedBy = (owner: FavoriteOwner) =>
  and(eq(favorites.workspaceId, owner.workspaceId), eq(favorites.userId, owner.userId))

/** Whether the entity exists in the workspace. Views (M10-05) don't exist yet, so never. */
async function entityExists(
  db: DbOrTx,
  workspaceId: string,
  entityType: FavoriteEntityType,
  entityId: string,
): Promise<boolean> {
  const table = { issue: issues, project: projects, team: teams, view: null }[entityType]
  if (!table) return false
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.workspaceId, workspaceId), eq(table.id, entityId)))
  return Boolean(row)
}

/** Adds the entity to the end of the user's favorites; adding it again returns the existing one. */
export async function addFavorite(
  db: DbOrTx,
  owner: FavoriteOwner,
  input: { entityType: FavoriteEntityType; entityId: string },
) {
  if (!(await entityExists(db, owner.workspaceId, input.entityType, input.entityId))) {
    throw new DomainError('NOT_FOUND', 'Not found')
  }
  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ sortOrder: max(favorites.sortOrder) })
      .from(favorites)
      .where(ownedBy(owner))
    await tx
      .insert(favorites)
      .values({ ...owner, ...input, sortOrder: (last?.sortOrder ?? -1) + 1 })
      .onConflictDoNothing({
        target: [favorites.userId, favorites.entityType, favorites.entityId],
      })
    const [row] = await tx
      .select()
      .from(favorites)
      .where(
        and(
          ownedBy(owner),
          eq(favorites.entityType, input.entityType),
          eq(favorites.entityId, input.entityId),
        ),
      )
    if (!row) throw new Error('favorite upsert returned no row')
    return row
  })
}

export async function removeFavorite(db: DbOrTx, owner: FavoriteOwner, id: string) {
  const [row] = await db
    .delete(favorites)
    .where(and(ownedBy(owner), eq(favorites.id, id)))
    .returning({ id: favorites.id })
  if (!row) throw new DomainError('NOT_FOUND', 'Favorite not found')
  return row
}

/** Rewrites every position (the list is small); ids that aren't the user's are NOT_FOUND. */
export async function reorderFavorites(db: DbOrTx, owner: FavoriteOwner, ids: string[]) {
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: favorites.id })
      .from(favorites)
      .where(ownedBy(owner))
      .orderBy(asc(favorites.sortOrder), asc(favorites.createdAt))
      .for('update')
    const order = mergeFavoriteOrder(
      current.map((row) => row.id),
      ids,
    )
    if (!order) throw new DomainError('NOT_FOUND', 'Favorite not found')
    for (const [sortOrder, id] of order.entries()) {
      await tx
        .update(favorites)
        .set({ sortOrder })
        .where(and(ownedBy(owner), eq(favorites.id, id)))
    }
  })
}

export type FavoriteSummary =
  | { entityType: 'issue'; identifier: string; title: string; statusCategory: StatusCategory }
  | { entityType: 'project'; name: string; iconUploadId: string | null }
  | { entityType: 'team'; name: string; key: string }

export type FavoriteWithSummary = {
  id: string
  entityId: string
  sortOrder: number
  summary: FavoriteSummary
}

/**
 * The user's favorites in order, each with what the sidebar shows. Favorites whose entity is gone
 * (or a type that can't be resolved yet, like views) are left out.
 */
export async function listFavorites(
  db: DbOrTx,
  owner: FavoriteOwner,
): Promise<FavoriteWithSummary[]> {
  const rows = await db
    .select()
    .from(favorites)
    .where(ownedBy(owner))
    .orderBy(asc(favorites.sortOrder), asc(favorites.createdAt))
  const idsOf = (type: FavoriteEntityType) =>
    rows.filter((row) => row.entityType === type).map((row) => row.entityId)
  const { workspaceId } = owner

  const issueIds = idsOf('issue')
  const issueRows = issueIds.length
    ? await db
        .select({
          id: issues.id,
          number: issues.number,
          title: issues.title,
          teamKey: teams.key,
          statusCategory: workflowStatuses.category,
        })
        .from(issues)
        .innerJoin(teams, eq(teams.id, issues.teamId))
        .innerJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
        .where(and(eq(issues.workspaceId, workspaceId), inArray(issues.id, issueIds)))
    : []
  const projectIds = idsOf('project')
  const projectRows = projectIds.length
    ? await db
        .select({ id: projects.id, name: projects.name, iconUploadId: projects.iconUploadId })
        .from(projects)
        .where(and(eq(projects.workspaceId, workspaceId), inArray(projects.id, projectIds)))
    : []
  const teamIds = idsOf('team')
  const teamRows = teamIds.length
    ? await db
        .select({ id: teams.id, name: teams.name, key: teams.key })
        .from(teams)
        .where(and(eq(teams.workspaceId, workspaceId), inArray(teams.id, teamIds)))
    : []

  const summaries = new Map<string, FavoriteSummary>([
    ...issueRows.map((row): [string, FavoriteSummary] => [
      `issue:${row.id}`,
      {
        entityType: 'issue',
        identifier: `${row.teamKey}-${row.number}`,
        title: row.title,
        statusCategory: row.statusCategory,
      },
    ]),
    ...projectRows.map((row): [string, FavoriteSummary] => [
      `project:${row.id}`,
      { entityType: 'project', name: row.name, iconUploadId: row.iconUploadId },
    ]),
    ...teamRows.map((row): [string, FavoriteSummary] => [
      `team:${row.id}`,
      { entityType: 'team', name: row.name, key: row.key },
    ]),
  ])
  return rows.flatMap((row) => {
    const summary = summaries.get(`${row.entityType}:${row.entityId}`)
    return summary
      ? [{ id: row.id, entityId: row.entityId, sortOrder: row.sortOrder, summary }]
      : []
  })
}

/**
 * Removes every user's favorites of the given entities. There is no FK from a favorite to its
 * entity, so each delete of an issue, project, team or view calls this in its own transaction.
 */
export async function deleteFavoritesOf(
  tx: DbOrTx,
  workspaceId: string,
  entityType: FavoriteEntityType,
  entityIds: string[],
) {
  if (entityIds.length === 0) return
  await tx
    .delete(favorites)
    .where(
      and(
        eq(favorites.workspaceId, workspaceId),
        eq(favorites.entityType, entityType),
        inArray(favorites.entityId, entityIds),
      ),
    )
}
