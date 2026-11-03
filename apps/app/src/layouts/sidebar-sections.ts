/** Keys for the collapsible sidebar sections; each team row uses `teamSectionKey(teamId)`. */
export const SIDEBAR_SECTIONS = {
  workspace: 'workspace',
  teams: 'teams',
  favorites: 'favorites',
} as const

export function teamSectionKey(teamId: string) {
  return `team:${teamId}`
}

/** Sections start expanded; team rows start collapsed (a team opens when you navigate into it). */
export function isSectionExpanded(state: Record<string, boolean>, key: string): boolean {
  return state[key] ?? !key.startsWith('team:')
}

/** Returns a new state with `key` set (or toggled), so the localStorage ref sees a fresh object. */
export function setSectionExpanded(
  state: Record<string, boolean>,
  key: string,
  expanded = !isSectionExpanded(state, key),
): Record<string, boolean> {
  return { ...state, [key]: expanded }
}
