import type { ViewFilters, ViewFiltersInput } from '@linear/contract'
import type { LocationQuery } from 'vue-router'
import {
  EMPTY_FILTERS,
  parseIssueFilters,
  serializeIssueFilters,
  toListInput,
  type DateDimension,
  type DateFilter,
  type IssueFilters,
} from '@/features/issues/issue-filters'
import { todayIso } from '@/lib/due-dates'

/** Each date filter's stored keys: absolute bounds from the list input, plus a window. */
const DATE_KEYS = {
  created: { after: 'createdAfter', before: 'createdBefore', within: 'createdWithin' },
  updated: { after: 'updatedAfter', before: 'updatedBefore', within: 'updatedWithin' },
  completed: { after: 'completedSince', before: 'completedBefore', within: 'completedWithin' },
} as const satisfies Record<DateDimension, Record<string, keyof ViewFilters>>

const DATE_DIMENSIONS = Object.keys(DATE_KEYS) as DateDimension[]

/**
 * The filters a view saves: the `issues.list` filters the filter bar sets, with every
 * "past …" window kept relative (`…Within`) instead of the bound it means right now.
 * `today` only anchors due buckets to the viewer's day, so it isn't stored.
 */
export function toViewFilters(filters: IssueFilters): ViewFiltersInput {
  // Unset filters are `undefined`, which JSON leaves out of the stored row.
  const { today: _today, ...stored }: ViewFiltersInput & { today?: string } = toListInput(filters)
  for (const dimension of DATE_DIMENSIONS) {
    const filter = filters[dimension]
    if (filter?.kind !== 'past') continue
    stored[DATE_KEYS[dimension].after] = undefined
    stored[DATE_KEYS[dimension].within] = filter.period
  }
  return stored
}

/** A stored bound back as the viewer's calendar day (it was saved as local midnight). */
function storedDate(stored: ViewFilters, dimension: DateDimension): DateFilter | null {
  const keys = DATE_KEYS[dimension]
  const within = stored[keys.within]
  if (within) return { kind: 'past', period: within }
  const after = stored[keys.after]
  if (after) return { kind: 'after', date: todayIso(after) }
  const before = stored[keys.before]
  if (before) return { kind: 'before', date: todayIso(before) }
  return null
}

/** One dimension stored as `…Ids` or `…IdsNot`: the values and whether they exclude. */
function operatorValues<T>(is: T[] | undefined, not: T[] | undefined) {
  return is?.length ? { values: is, not: false } : { values: not ?? [], not: Boolean(not?.length) }
}

/** A view's stored filters as the filter bar's state (what's not set is empty). */
export function fromViewFilters(stored: ViewFilters): IssueFilters {
  const status = operatorValues(stored.statusIds, stored.statusIdsNot)
  const priority = operatorValues(stored.priorities, stored.prioritiesNot)
  const assignee = operatorValues(stored.assigneeIds, stored.assigneeIdsNot)
  const project = operatorValues(stored.projectIds, stored.projectIdsNot)
  const creator = operatorValues(stored.creatorIds, stored.creatorIdsNot)
  const label = operatorValues(stored.labelIds, stored.labelIdsNot)
  const operators: IssueFilters['operators'] = {}
  if (status.not) operators.status = 'not'
  if (priority.not) operators.priority = 'not'
  if (assignee.not) operators.assignee = 'not'
  if (project.not) operators.project = 'not'
  if (creator.not) operators.creator = 'not'
  if (label.not) operators.label = 'not'
  else if (label.values.length && stored.labelMode === 'all') operators.label = 'all'
  return {
    ...EMPTY_FILTERS,
    statusIds: status.values,
    priorities: priority.values,
    assigneeIds: assignee.values,
    projectIds: project.values,
    milestoneIds: stored.milestoneIds ?? [],
    cycleIds: stored.cycleIds ?? [],
    labelIds: label.values,
    creatorIds: creator.values,
    operators,
    estimates: stored.estimates ?? [],
    due: stored.due ?? [],
    subscriberIds: stored.subscriberIds ?? [],
    created: storedDate(stored, 'created'),
    updated: storedDate(stored, 'updated'),
    completed: storedDate(stored, 'completed'),
    content: stored.content ?? '',
    hasPullRequests: stored.hasPullRequests ?? null,
    q: stored.q ?? '',
    hasLinks: stored.hasLinks ?? null,
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
