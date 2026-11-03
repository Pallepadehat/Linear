/**
 * Multi-select for issue lists and boards (docs/domain.md → Bulk actions). Sets are
 * replaced, never mutated, so Vue sees every change.
 */

/** Adds or removes one issue. */
export function toggleSelection(current: ReadonlySet<string>, id: string) {
  const next = new Set(current)
  if (!next.delete(id)) next.add(id)
  return next
}

/**
 * Shift-click: adds every issue between the anchor (the last one clicked) and
 * `target` in render order, both included. Without an anchor still on screen it
 * just adds `target`.
 */
export function selectRange(
  order: readonly string[],
  anchor: string | null,
  target: string,
  current: ReadonlySet<string>,
) {
  const next = new Set(current)
  const to = order.indexOf(target)
  if (to === -1) return next
  const from = anchor === null ? -1 : order.indexOf(anchor)
  if (from === -1) return next.add(target)
  const [start, end] = from < to ? [from, to] : [to, from]
  for (const id of order.slice(start, end + 1)) next.add(id)
  return next
}

/** A group's checkbox: `true` when every issue in it is selected, `'mixed'` for some. */
export function groupSelectionState(current: ReadonlySet<string>, ids: readonly string[]) {
  const count = ids.filter((id) => current.has(id)).length
  if (count === 0) return false
  return count === ids.length ? true : 'mixed'
}

/** The group checkbox: selects the whole group, or clears it when it's all selected already. */
export function toggleGroupSelection(current: ReadonlySet<string>, ids: readonly string[]) {
  const next = new Set(current)
  if (groupSelectionState(current, ids) === true) for (const id of ids) next.delete(id)
  else for (const id of ids) next.add(id)
  return next
}

/** Drops ids that are no longer listed (deleted, filtered out); same set when nothing left. */
export function retainSelection(current: ReadonlySet<string>, listed: ReadonlySet<string>) {
  if ([...current].every((id) => listed.has(id))) return current
  return new Set([...current].filter((id) => listed.has(id)))
}
