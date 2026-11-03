/** What an id inside a view's filters must be in the view's workspace. */
export type FilterRefKind = 'status' | 'member' | 'project' | 'milestone' | 'cycle' | 'label'

// `<entity>Ids` and `<entity>IdsNot` filters (docs/domain.md → Views); new ones are checked as
// soon as they follow the naming.
const ENTITY_KINDS: Record<string, FilterRefKind> = {
  status: 'status',
  assignee: 'member',
  creator: 'member',
  subscriber: 'member',
  project: 'project',
  milestone: 'milestone',
  cycle: 'cycle',
  label: 'label',
}
const ID_FILTER = /^([a-z]+)Ids(Not)?$/

export type FilterRefs = Record<FilterRefKind, string[]>

/**
 * The ids a view's filters reference, by kind. `null` (no value) and `'me'` (the viewer)
 * aren't ids; an id filter for an unknown entity is an error so it can't skip the check.
 */
export function collectFilterRefs(filters: Record<string, unknown>): FilterRefs {
  const refs: Record<FilterRefKind, Set<string>> = {
    status: new Set(),
    member: new Set(),
    project: new Set(),
    milestone: new Set(),
    cycle: new Set(),
    label: new Set(),
  }
  for (const [key, value] of Object.entries(filters)) {
    const match = ID_FILTER.exec(key)
    if (!match) continue
    const kind = ENTITY_KINDS[match[1]!]
    if (!kind) throw new Error(`No workspace check for view filter "${key}"`)
    if (!Array.isArray(value)) continue
    for (const id of value) if (typeof id === 'string' && id !== 'me') refs[kind].add(id)
  }
  return {
    status: [...refs.status],
    member: [...refs.member],
    project: [...refs.project],
    milestone: [...refs.milestone],
    cycle: [...refs.cycle],
    label: [...refs.label],
  }
}
