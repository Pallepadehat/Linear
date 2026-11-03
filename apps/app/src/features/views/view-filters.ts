import type { ViewFilters, ViewFiltersInput } from '@linear/contract'
import type { LocationQuery } from 'vue-router'
import {
  EMPTY_FILTERS,
  parseIssueFilters,
  serializeIssueFilters,
  type IssueFilters,
} from '@/features/issues/issue-filters'

/** The filters a view saves: only the ones set, so an empty filter isn't stored. */
export function toViewFilters(filters: IssueFilters): ViewFiltersInput {
  const { q, hasLinks, ...lists } = filters
  const set = Object.entries(lists).filter(([, values]) => values.length > 0)
  return {
    ...(Object.fromEntries(set) as ViewFiltersInput),
    ...(q.trim() && { q: q.trim() }),
    // Only "Has links" is offered; `false` would mean "has no links".
    ...(hasLinks && { hasLinks }),
  }
}

/** A view's stored filters as the filter bar's state (what's not set is empty). */
export function fromViewFilters(stored: ViewFilters): IssueFilters {
  return {
    statusIds: stored.statusIds ?? [],
    priorities: stored.priorities ?? [],
    assigneeIds: stored.assigneeIds ?? [],
    projectIds: stored.projectIds ?? [],
    milestoneIds: stored.milestoneIds ?? [],
    cycleIds: stored.cycleIds ?? [],
    labelIds: stored.labelIds ?? [],
    estimates: stored.estimates ?? [],
    due: stored.due ?? [],
    subscriberIds: stored.subscriberIds ?? [],
    q: stored.q ?? '',
    hasLinks: stored.hasLinks === true,
  }
}

/** The same filters, regardless of the order values were picked in. */
export function sameFilters(a: IssueFilters, b: IssueFilters) {
  const key = (filters: IssueFilters) => {
    const query = serializeIssueFilters(filters)
    return JSON.stringify(
      Object.keys(query)
        .sort()
        .map((k) => [k, String(query[k]).split(',').sort().join(',')]),
    )
  }
  return key(a) === key(b)
}

/** Whether the route query carries any filter (a reload or shared link of an edited view). */
export function hasFilterQuery(query: LocationQuery) {
  return !sameFilters(parseIssueFilters(query), EMPTY_FILTERS)
}
