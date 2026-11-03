import type { LocationQuery } from 'vue-router'

export const PROJECT_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'activity', label: 'Activity' },
  { value: 'issues', label: 'Issues' },
] as const

export type ProjectTab = (typeof PROJECT_TABS)[number]['value']

/** `?tab=` on the project page; Overview (the default) has no param, unknown values fall back. */
export function parseProjectTab(query: LocationQuery): ProjectTab {
  const raw = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return PROJECT_TABS.some((tab) => tab.value === raw) ? (raw as ProjectTab) : 'overview'
}

/** The route query for `tab`, keeping other params (issue filters) as they are. */
export function projectTabQuery(query: LocationQuery, tab: ProjectTab): LocationQuery {
  const { tab: _tab, ...rest } = query
  return tab === 'overview' ? rest : { ...rest, tab }
}
