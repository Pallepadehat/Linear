import type { IssueFacets } from '@linear/contract'
import type { Component } from 'vue'
import type { FilterDimension } from './composables/useFilterDimensions'
import { NONE } from './issue-filters'
import type { IssueView } from './issue-view'

/** The Details panel's pill tabs, in Linear's order. */
export type DetailsTab = 'assignees' | 'labels' | 'priority' | 'projects'

export const DETAILS_TABS: readonly { value: DetailsTab; label: string }[] = [
  { value: 'assignees', label: 'Assignees' },
  { value: 'labels', label: 'Labels' },
  { value: 'priority', label: 'Priority' },
  { value: 'projects', label: 'Projects' },
]

const DIMENSION: Record<DetailsTab, FilterDimension['key']> = {
  assignees: 'assignee',
  labels: 'label',
  priority: 'priority',
  projects: 'project',
}

/** Open/closed is remembered per view: a team's (or the workspace's) Active / Backlog / All tab. */
export function detailsPanelKey(teamId: string | undefined, view: IssueView) {
  return `${teamId ?? 'workspace'}:${view}`
}

export type FacetRow = {
  key: string
  label: string
  icon: Component
  count: number
  selected: boolean
  toggle: () => void
}

/** Facet entries keyed like the filter menu's options (`none` = no assignee / no project). */
function counts(facets: IssueFacets, tab: DetailsTab): { key: string; count: number }[] {
  switch (tab) {
    case 'assignees':
      return facets.assignees.map((f) => ({ key: f.id ?? NONE, count: f.count }))
    case 'labels':
      return facets.labels.map((f) => ({ key: f.id, count: f.count }))
    case 'priority':
      return facets.priorities.map((f) => ({ key: String(f.value), count: f.count }))
    case 'projects':
      return facets.projects.map((f) => ({ key: f.id ?? NONE, count: f.count }))
  }
}

/**
 * One row per value with issues, most first, named and toggled through the filter
 * menu's options so a click filters exactly like the menu does. Values the user
 * filtered on stay listed (at 0) so they can be switched off here too; values the
 * workspace no longer knows (a deleted label) are left out.
 */
export function facetRows(
  facets: IssueFacets | undefined,
  tab: DetailsTab,
  dimensions: FilterDimension[],
): FacetRow[] {
  const dimension = dimensions.find((d) => d.key === DIMENSION[tab])
  if (!facets || !dimension) return []
  const options = new Map(dimension.options.map((option) => [option.key, option]))
  const entries = counts(facets, tab)
  const listed = new Set(entries.map((e) => e.key))
  for (const option of dimension.options) {
    if (option.selected && !listed.has(option.key)) entries.push({ key: option.key, count: 0 })
  }
  return entries
    .flatMap(({ key, count }) => {
      const option = options.get(key)
      if (!option) return []
      const { label, icon, selected, toggle } = option
      return [{ key, label, icon, count, selected, toggle }]
    })
    .sort((a, b) => b.count - a.count)
}
