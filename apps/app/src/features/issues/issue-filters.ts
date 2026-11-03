import type { IssueDueFilter, IssueSort, SortDirection } from '@linear/contract'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'

type QueryValue = LocationQuery[string] | undefined

/** In the URL, `none` stands for "no assignee" / "no project" / "no cycle" / "no estimate". */
export const NONE = 'none'
/** In the URL, `any` stands for "has an estimate". */
export const ANY = 'any'

/** Estimate filter values: points, `null` = no estimate, `'any'` = has one. */
export type EstimateFilterValue = number | typeof ANY | null
/** In the URL and the API, `me` stands for the signed-in user. */
export const ME = 'me'

export type IssueFilters = {
  statusIds: string[]
  priorities: number[]
  /** `null` = no assignee. */
  assigneeIds: (string | null)[]
  /** `null` = no project. */
  projectIds: (string | null)[]
  /** `null` = no cycle. */
  cycleIds: (string | null)[]
  labelIds: string[]
  estimates: EstimateFilterValue[]
  /** Due date buckets, relative to the viewer's today (domain.md → Due dates). */
  due: IssueDueFilter[]
  /** User ids, or `me`. */
  subscriberIds: string[]
  q: string
  sort: IssueSort
  direction: SortDirection
  /** Only issues with a web link or a linked PR (domain.md → Links). */
  hasLinks: boolean
  /** Display option: whether issues with a parent are listed (nested under it when loaded). */
  showSubIssues: boolean
}

export const DEFAULT_SORT: IssueSort = 'createdAt'
export const DEFAULT_DIRECTION: SortDirection = 'desc'

export const EMPTY_FILTERS: IssueFilters = {
  statusIds: [],
  priorities: [],
  assigneeIds: [],
  projectIds: [],
  cycleIds: [],
  labelIds: [],
  estimates: [],
  due: [],
  subscriberIds: [],
  q: '',
  sort: DEFAULT_SORT,
  direction: DEFAULT_DIRECTION,
  showSubIssues: true,
  hasLinks: false,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SORTS: readonly IssueSort[] = ['createdAt', 'updatedAt', 'priority', 'estimate', 'dueDate']
export const DUE_FILTERS: readonly IssueDueFilter[] = ['overdue', 'dueThisWeek', 'noDueDate']

function first(value: QueryValue) {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/** Comma-separated (`?status=a,b`); repeated keys (`?status=a&status=b`) work too. */
function list(value: QueryValue) {
  const raw = Array.isArray(value) ? value : [value ?? null]
  const items = raw.flatMap((v) => (v ? v.split(',') : [])).map((v) => v.trim())
  return [...new Set(items.filter(Boolean))]
}

const ids = (value: QueryValue) => list(value).filter((v) => UUID.test(v))
const idsOrNone = (value: QueryValue) =>
  list(value).flatMap((v) => (v === NONE ? [null] : UUID.test(v) ? [v] : []))

/**
 * Reads filters from the route query. Unknown or malformed values are dropped
 * rather than failing, so a hand-edited or stale URL still opens a view.
 */
export function parseIssueFilters(query: LocationQuery): IssueFilters {
  const sort = first(query.sort)
  const direction = first(query.dir)
  return {
    statusIds: ids(query.status),
    priorities: list(query.priority)
      .filter((v) => /^[0-4]$/.test(v))
      .map(Number),
    assigneeIds: idsOrNone(query.assignee),
    projectIds: idsOrNone(query.project),
    cycleIds: idsOrNone(query.cycle),
    labelIds: ids(query.label),
    estimates: list(query.estimate).flatMap((v): EstimateFilterValue[] =>
      v === NONE ? [null] : v === ANY ? [ANY] : /^\d{1,3}$/.test(v) ? [Number(v)] : [],
    ),
    due: list(query.due).filter((v): v is IssueDueFilter =>
      DUE_FILTERS.includes(v as IssueDueFilter),
    ),
    subscriberIds: list(query.subscriber).filter((v) => v === ME || UUID.test(v)),
    q: first(query.q).trim(),
    sort: SORTS.includes(sort as IssueSort) ? (sort as IssueSort) : DEFAULT_SORT,
    direction: direction === 'asc' || direction === 'desc' ? direction : DEFAULT_DIRECTION,
    showSubIssues: first(query.subIssues) !== 'hide',
    hasLinks: first(query.links) === 'has',
  }
}

/** The inverse of `parseIssueFilters`; defaults and empty filters are left out of the URL. */
export function serializeIssueFilters(filters: IssueFilters): LocationQueryRaw {
  const join = (values: readonly (string | number | null)[]) =>
    values.length ? values.map((v) => (v === null ? NONE : String(v))).join(',') : undefined
  const query: LocationQueryRaw = {
    status: join(filters.statusIds),
    priority: join(filters.priorities),
    assignee: join(filters.assigneeIds),
    project: join(filters.projectIds),
    cycle: join(filters.cycleIds),
    label: join(filters.labelIds),
    estimate: join(filters.estimates),
    due: join(filters.due),
    subscriber: join(filters.subscriberIds),
    q: filters.q.trim() || undefined,
    sort: filters.sort === DEFAULT_SORT ? undefined : filters.sort,
    dir: filters.direction === DEFAULT_DIRECTION ? undefined : filters.direction,
    subIssues: filters.showSubIssues ? undefined : 'hide',
    links: filters.hasLinks ? 'has' : undefined,
  }
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined))
}

export function hasActiveFilters(filters: IssueFilters) {
  return (
    filters.statusIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.projectIds.length > 0 ||
    filters.cycleIds.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.estimates.length > 0 ||
    filters.due.length > 0 ||
    filters.subscriberIds.length > 0 ||
    filters.hasLinks ||
    filters.q !== ''
  )
}

/** Adds the values if any is missing, otherwise removes them all (one option can map to several ids). */
export function toggleValues<T>(current: T[], values: T[]): T[] {
  const allIn = values.every((v) => current.includes(v))
  return allIn
    ? current.filter((v) => !values.includes(v))
    : [...current, ...values.filter((v) => !current.includes(v))]
}
