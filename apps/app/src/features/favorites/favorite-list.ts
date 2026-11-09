import type { Favorite, FavoriteEntityType } from '@linear/contract'

/** What a page offers to the star: the entity plus the summary the sidebar shows for it. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type FavoriteTarget = DistributiveOmit<Favorite, 'id'>

export type FavoriteRef = { entityType: FavoriteEntityType; entityId: string }

export function findFavorite(list: Favorite[] | undefined, ref: FavoriteRef) {
  return list?.find((f) => f.entityType === ref.entityType && f.entityId === ref.entityId)
}

/** Optimistic rows carry a placeholder id until the refetch; the server can't act on them yet. */
export const PENDING_PREFIX = 'pending-'
export const isPending = (favorite: Favorite) => favorite.id.startsWith(PENDING_PREFIX)

/** Returns a new list with the item at `from` moved to index `to`. */
export function moveFavorite<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item as T)
  return next
}
