import type { IssueDueFilter, IssueFiltersInput, IssueSort, SortDirection } from '@linear/contract'
import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import { todayIso } from '@/lib/due-dates'

type QueryValue = LocationQuery[string] | undefined

/** In the URL, `none` stands for "no assignee" / "no project" / "no cycle" / "no estimate". */
export const NONE = 'none'
/** In the URL, `any` stands for "has an estimate". */
export const ANY = 'any'

/** Estimate filter values: points, `null` = no estimate, `'any'` = has one. */
export type EstimateFilterValue = number | typeof ANY | null
/** In the URL and the API, `me` stands for the signed-in user. */
export const ME = 'me'

/** Dimensions whose chip operator can be flipped (docs/domain.md → Issues → filters). */
export type OperatorDimension = 'status' | 'priority' | 'assignee' | 'project' | 'creator' | 'label'
/**
 * `is` (one value) / "is any of" (several) is the default and isn't stored; `not`
 * excludes the values; `all` (labels only) needs every label.
 */
export type FilterOperator = 'is' | 'not' | 'all'

export type DateDimension = 'created' | 'updated' | 'completed'
export type DatePeriod = 'day' | 'week' | 'month' | '3months'
/** "Past week" stays relative to when the list loads; before/after are local calendar days. */
export type DateFilter =
  { kind: 'past'; period: DatePeriod } | { kind: 'before' | 'after'; date: string }

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
  /** User ids, or `me`. */
  creatorIds: string[]
  /** Non-default operators per dimension; a dimension without values has none. */
  operators: Partial<Record<OperatorDimension, Exclude<FilterOperator, 'is'>>>
  estimates: EstimateFilterValue[]
  /** Due date buckets, relative to the viewer's today (domain.md → Due dates). */
  due: IssueDueFilter[]
  /** User ids, or `me`. */
  subscriberIds: string[]
  created: DateFilter | null
  updated: DateFilter | null
  completed: DateFilter | null
  /** Title or description contains. */
  content: string
  /** Has (`true`) or lacks (`false`) a linked pull request; `null` = no filter. */
  hasPullRequests: boolean | null
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
  creatorIds: [],
  operators: {},
  estimates: [],
  due: [],
  subscriberIds: [],
  created: null,
  updated: null,
  completed: null,
  content: '',
  hasPullRequests: null,
  q: '',
  sort: DEFAULT_SORT,
  direction: DEFAULT_DIRECTION,
  showSubIssues: true,
  hasLinks: false,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SORTS: readonly IssueSort[] = ['createdAt', 'updatedAt', 'priority', 'estimate', 'dueDate']
export const DUE_FILTERS: readonly IssueDueFilter[] = ['overdue', 'dueThisWeek', 'noDueDate']
export const DATE_PERIODS: readonly DatePeriod[] = ['day', 'week', 'month', '3months']
const DATE_DIMENSIONS: readonly DateDimension[] = ['created', 'updated', 'completed']

const OPERATOR_DIMENSIONS: readonly OperatorDimension[] = [
  'status',
  'priority',
  'assignee',
  'project',
  'creator',
  'label',
]

/** Every route query key the filters own (other params are left alone on update). */
export const FILTER_QUERY_KEYS = [
  // `?status=` is "is", `?status-not=` "is not", `?label-all=` "include all of".
  ...OPERATOR_DIMENSIONS.flatMap((key) => [key, `${key}-not`]),
  'label-all',
  'cycle',
  'estimate',
  'due',
  'subscriber',
  ...DATE_DIMENSIONS,
  'content',
  'pr',
  'links',
  'q',
  'sort',
  'dir',
  'subIssues',
]

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
const users = (value: QueryValue) => list(value).filter((v) => v === ME || UUID.test(v))
const priorities = (value: QueryValue) =>
  list(value)
    .filter((v) => /^[0-4]$/.test(v))
    .map(Number)

function isCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y = 0, m = 0, d = 0] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** `past-week`, `before-2026-10-01`, `after-2026-10-01`. */
function parseDateFilter(value: QueryValue): DateFilter | null {
  const raw = first(value)
  const past = /^past-(.+)$/.exec(raw)
  if (past && DATE_PERIODS.includes(past[1] as DatePeriod)) {
    return { kind: 'past', period: past[1] as DatePeriod }
  }
  const bound = /^(before|after)-(.+)$/.exec(raw)
  if (bound && isCalendarDay(bound[2]!)) {
    return { kind: bound[1] as 'before' | 'after', date: bound[2]! }
  }
  return null
}

function serializeDateFilter(filter: DateFilter | null) {
  if (!filter) return undefined
  return filter.kind === 'past' ? `past-${filter.period}` : `${filter.kind}-${filter.date}`
}

/**
 * One operator dimension: `?key=` wins over `?key-not=` (and `?label-all=`), so a
 * hand-edited URL with both still reads as a single chip.
 */
function readOperator<T>(
  query: LocationQuery,
  key: string,
  parse: (value: QueryValue) => T[],
  allowAll = false,
): { values: T[]; operator?: 'not' | 'all' } {
  const is = parse(query[key])
  if (is.length) return { values: is }
  if (allowAll) {
    const all = parse(query[`${key}-all`])
    if (all.length) return { values: all, operator: 'all' }
  }
  const not = parse(query[`${key}-not`])
  return not.length ? { values: not, operator: 'not' } : { values: [] }
}

/**
 * Reads filters from the route query. Unknown or malformed values are dropped
 * rather than failing, so a hand-edited or stale URL still opens a view.
 */
export function parseIssueFilters(query: LocationQuery): IssueFilters {
  const sort = first(query.sort)
  const direction = first(query.dir)
  const status = readOperator(query, 'status', ids)
  const priority = readOperator(query, 'priority', priorities)
  const assignee = readOperator(query, 'assignee', idsOrNone)
  const project = readOperator(query, 'project', idsOrNone)
  const creator = readOperator(query, 'creator', users)
  const label = readOperator(query, 'label', ids, true)
  const operators: IssueFilters['operators'] = {}
  for (const [dimension, parsed] of Object.entries({
    status,
    priority,
    assignee,
    project,
    creator,
    label,
  })) {
    if (parsed.operator) operators[dimension as OperatorDimension] = parsed.operator
  }
  const pr = first(query.pr)
  return {
    statusIds: status.values,
    priorities: priority.values,
    assigneeIds: assignee.values,
    projectIds: project.values,
    cycleIds: idsOrNone(query.cycle),
    labelIds: label.values,
    creatorIds: creator.values,
    operators,
    estimates: list(query.estimate).flatMap((v): EstimateFilterValue[] =>
      v === NONE ? [null] : v === ANY ? [ANY] : /^\d{1,3}$/.test(v) ? [Number(v)] : [],
    ),
    due: list(query.due).filter((v): v is IssueDueFilter =>
      DUE_FILTERS.includes(v as IssueDueFilter),
    ),
    subscriberIds: users(query.subscriber),
    created: parseDateFilter(query.created),
    updated: parseDateFilter(query.updated),
    completed: parseDateFilter(query.completed),
    content: first(query.content).trim().slice(0, 255),
    hasPullRequests: pr === 'yes' ? true : pr === 'no' ? false : null,
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
  const withOperatorKey = (
    dimension: OperatorDimension,
    values: readonly (string | number | null)[],
  ) => {
    const operator = filters.operators[dimension]
    return { [operator ? `${dimension}-${operator}` : dimension]: join(values) }
  }
  const query: LocationQueryRaw = {
    ...withOperatorKey('status', filters.statusIds),
    ...withOperatorKey('priority', filters.priorities),
    ...withOperatorKey('assignee', filters.assigneeIds),
    ...withOperatorKey('project', filters.projectIds),
    cycle: join(filters.cycleIds),
    ...withOperatorKey('label', filters.labelIds),
    ...withOperatorKey('creator', filters.creatorIds),
    estimate: join(filters.estimates),
    due: join(filters.due),
    subscriber: join(filters.subscriberIds),
    created: serializeDateFilter(filters.created),
    updated: serializeDateFilter(filters.updated),
    completed: serializeDateFilter(filters.completed),
    content: filters.content.trim() || undefined,
    pr: filters.hasPullRequests === null ? undefined : filters.hasPullRequests ? 'yes' : 'no',
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
    filters.creatorIds.length > 0 ||
    filters.estimates.length > 0 ||
    filters.due.length > 0 ||
    filters.subscriberIds.length > 0 ||
    filters.created !== null ||
    filters.updated !== null ||
    filters.completed !== null ||
    filters.content !== '' ||
    filters.hasPullRequests !== null ||
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

/** The chip's operator cycle: is → is not → is → … (labels: any of → all of → not → any of). */
export function nextOperator(
  current: FilterOperator | undefined,
  dimension: OperatorDimension,
): FilterOperator {
  const cycle: FilterOperator[] = dimension === 'label' ? ['is', 'all', 'not'] : ['is', 'not']
  return cycle[(cycle.indexOf(current ?? 'is') + 1) % cycle.length]!
}

/** The chip text for an operator, Linear's wording: "is" / "is any of" / "is not" / … */
export function operatorLabel(operator: FilterOperator | undefined, count: number) {
  if (operator === 'all') return 'include all of'
  if (operator === 'not') return count > 1 ? 'is none of' : 'is not'
  return count > 1 ? 'is any of' : 'is'
}

/** The changes that set a dimension's operator; `is` clears the stored one. */
export function withOperator(
  filters: IssueFilters,
  dimension: OperatorDimension,
  operator: FilterOperator,
): Pick<IssueFilters, 'operators'> {
  const { [dimension]: _, ...rest } = filters.operators
  return { operators: operator === 'is' ? rest : { ...rest, [dimension]: operator } }
}

/** Local midnight starting `date` (`YYYY-MM-DD`): the viewer's calendar day. */
function startOfLocalDay(date: string) {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Start of a "past …" window. Months are calendar months back from `now`. */
export function periodStart(period: DatePeriod, now: Date) {
  const start = new Date(now)
  if (period === 'day') start.setDate(start.getDate() - 1)
  else if (period === 'week') start.setDate(start.getDate() - 7)
  else start.setMonth(start.getMonth() - (period === 'month' ? 1 : 3))
  return start
}

/** `{ after, before }` bounds for one date filter; "before" a day excludes that day. */
export function dateBounds(filter: DateFilter | null, now: Date) {
  if (!filter) return {}
  if (filter.kind === 'past') return { after: periodStart(filter.period, now) }
  const at = startOfLocalDay(filter.date)
  return filter.kind === 'after' ? { after: at } : { before: at }
}

/**
 * The user's filters as `issues.list` / `issues.facets` input. `now` anchors the
 * "past …" windows and `today` the relative due buckets; both come from the viewer's
 * clock, so the server never guesses a timezone. Operators route each dimension's
 * values to the plain or `…Not` list.
 */
export function toListInput(
  filters: IssueFilters,
  now = new Date(),
): Omit<IssueFiltersInput, 'workspaceSlug'> {
  const { operators: ops } = filters
  const split = <T>(dimension: OperatorDimension, values: T[]) =>
    values.length ? (ops[dimension] === 'not' ? { not: values } : { is: values }) : {}
  const status = split('status', filters.statusIds)
  const priority = split('priority', filters.priorities)
  const assignee = split('assignee', filters.assigneeIds)
  const project = split('project', filters.projectIds)
  const creator = split('creator', filters.creatorIds)
  const label = split('label', filters.labelIds)
  const created = dateBounds(filters.created, now)
  const updated = dateBounds(filters.updated, now)
  const completed = dateBounds(filters.completed, now)
  // Relative due filters are evaluated against the viewer's local day (domain.md).
  const relativeDue = filters.due.some((bucket) => bucket !== 'noDueDate')
  const input = {
    statusIds: status.is,
    statusIdsNot: status.not,
    priorities: priority.is,
    prioritiesNot: priority.not,
    assigneeIds: assignee.is,
    assigneeIdsNot: assignee.not,
    projectIds: project.is,
    projectIdsNot: project.not,
    cycleIds: filters.cycleIds.length ? filters.cycleIds : undefined,
    labelIds: label.is,
    labelMode: label.is && ops.label === 'all' ? ('all' as const) : undefined,
    labelIdsNot: label.not,
    creatorIds: creator.is,
    creatorIdsNot: creator.not,
    estimates: filters.estimates.length ? filters.estimates : undefined,
    due: filters.due.length ? filters.due : undefined,
    today: relativeDue ? todayIso(now) : undefined,
    subscriberIds: filters.subscriberIds.length ? filters.subscriberIds : undefined,
    createdAfter: created.after,
    createdBefore: created.before,
    updatedAfter: updated.after,
    updatedBefore: updated.before,
    completedAfter: completed.after,
    completedBefore: completed.before,
    content: filters.content.trim() || undefined,
    hasPullRequests: filters.hasPullRequests ?? undefined,
    // Only "Has links" is offered so far; `false` would mean "has no links".
    hasLinks: filters.hasLinks || undefined,
    q: filters.q || undefined,
    showSubIssues: filters.showSubIssues,
  }
  // Undefined keys would still be part of the query key.
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Omit<
    IssueFiltersInput,
    'workspaceSlug'
  >
}

/** The chip's values: the name of one value, else a count ("3 labels"). */
export function valuesSummary(labels: readonly string[], plural: string) {
  return labels.length === 1 ? labels[0]! : labels.length ? `${labels.length} ${plural}` : ''
}

export const DATE_PERIOD_LABELS: Record<DatePeriod, string> = {
  day: 'Past day',
  week: 'Past week',
  month: 'Past month',
  '3months': 'Past 3 months',
}

/** Chip text for a date filter: operator ("after" / "before" / "in the") and value. */
export function describeDateFilter(
  filter: DateFilter,
  locale?: string,
): { operator: string; value: string } {
  if (filter.kind === 'past') {
    return { operator: 'in the', value: DATE_PERIOD_LABELS[filter.period].toLowerCase() }
  }
  const [y = 0, m = 1, d = 1] = filter.date.split('-').map(Number)
  const value = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
  return { operator: filter.kind, value }
}
