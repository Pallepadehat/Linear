/**
 * The full order after a reorder: the requested ids first, in that order, then any favorites the
 * request didn't mention (e.g. added from another tab) in their current order. Unknown or repeated
 * ids return null so the caller can reject the request.
 */
export function mergeFavoriteOrder(currentIds: string[], requestedIds: string[]): string[] | null {
  const current = new Set(currentIds)
  const requested = new Set(requestedIds)
  if (requested.size !== requestedIds.length) return null
  if (requestedIds.some((id) => !current.has(id))) return null
  return [...requestedIds, ...currentIds.filter((id) => !requested.has(id))]
}
