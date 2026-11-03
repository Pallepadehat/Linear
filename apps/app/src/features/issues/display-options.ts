import {
  DISPLAY_PROPERTIES,
  displayOptionsSchema,
  type CompletedIssues,
  type DisplayOptions,
  type DisplayProperty,
  type IssueGrouping,
  type IssueSort,
  type ListIssuesInput,
  type StatusCategory,
} from '@linear/contract'

export type { CompletedIssues, DisplayOptions, DisplayProperty, IssueGrouping }

/** Every view starts here; "Reset" goes back to it (docs/domain.md → Display options). */
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  layout: 'list',
  grouping: 'status',
  groupDirection: 'asc',
  subGrouping: 'none',
  ordering: 'createdAt',
  orderDirection: 'desc',
  orderCompletedByRecency: false,
  completedIssues: 'all',
  showSubIssues: true,
  showEmptyGroups: false,
  // Updated is off by default, like Linear; everything else is on.
  properties: DISPLAY_PROPERTIES.filter((p) => p !== 'updatedAt'),
}

/**
 * Which view a set of options belongs to: `view:<id>` (a saved view's unsaved draft),
 * `team:<id>`, `project:<id>`, `cycle:<id>`, `my` (My issues) or `all` (All issues).
 */
export type DisplayViewKey =
  `view:${string}` | `team:${string}` | `project:${string}` | `cycle:${string}` | 'my' | 'all'

export function displayViewKey(scope: {
  savedViewId?: string
  teamId?: string
  projectId?: string
  cycleId?: string
  assignee?: 'me'
  creator?: 'me'
}): DisplayViewKey {
  if (scope.savedViewId) return `view:${scope.savedViewId}`
  if (scope.cycleId) return `cycle:${scope.cycleId}`
  if (scope.projectId) return `project:${scope.projectId}`
  if (scope.teamId) return `team:${scope.teamId}`
  if (scope.assignee || scope.creator) return 'my'
  return 'all'
}

/**
 * Reads stored options field by field, so a stale or hand-edited value only
 * falls back for that field instead of resetting the whole view.
 */
export function parseDisplayOptions(stored: unknown): DisplayOptions {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_DISPLAY_OPTIONS
  const record = stored as Record<string, unknown>
  const shape = displayOptionsSchema.shape
  const field = <K extends keyof DisplayOptions>(key: K): DisplayOptions[K] => {
    const parsed = shape[key].safeParse(record[key])
    return parsed.success ? (parsed.data as DisplayOptions[K]) : DEFAULT_DISPLAY_OPTIONS[key]
  }
  const properties = field('properties')
  return {
    layout: field('layout'),
    grouping: field('grouping'),
    groupDirection: field('groupDirection'),
    subGrouping: field('subGrouping'),
    ordering: field('ordering'),
    orderDirection: field('orderDirection'),
    orderCompletedByRecency: field('orderCompletedByRecency'),
    completedIssues: field('completedIssues'),
    showSubIssues: field('showSubIssues'),
    showEmptyGroups: field('showEmptyGroups'),
    // Kept in chip order and without duplicates.
    properties: DISPLAY_PROPERTIES.filter((p) => properties.includes(p)),
  }
}

export function isDefaultDisplayOptions(options: DisplayOptions) {
  return JSON.stringify(options) === JSON.stringify(DEFAULT_DISPLAY_OPTIONS)
}

/** Sub-groups only exist under a real grouping, and never repeat it. */
export function effectiveSubGrouping(options: DisplayOptions): IssueGrouping {
  return options.grouping === 'none' || options.subGrouping === options.grouping
    ? 'none'
    : options.subGrouping
}

const OPEN_CATEGORIES: StatusCategory[] = ['backlog', 'unstarted', 'started']
const WINDOW_MS: Record<'day' | 'week', number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
}

/** Start of the "Completed issues" window, or `undefined` for All / None. */
export function completedAfter(window: CompletedIssues, now = new Date()): Date | undefined {
  if (window === 'all' || window === 'none') return undefined
  // Whole minutes, so the query key (and its cache) stays put while the view is open.
  const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000)
  if (window === 'month') {
    start.setMonth(start.getMonth() - 1)
    return start
  }
  return new Date(start.getTime() - WINDOW_MS[window])
}

export type DisplayListInput = Pick<
  ListIssuesInput,
  'sort' | 'direction' | 'showSubIssues' | 'statusCategories' | 'completedAfter'
>

/**
 * The `issues.list` input the options decide. "None" for completed issues leaves
 * out the completed and canceled categories (on top of the view tab's, if any).
 */
export function displayListInput(
  options: DisplayOptions,
  viewCategories: StatusCategory[] | undefined,
  now = new Date(),
): DisplayListInput {
  const categories =
    options.completedIssues === 'none'
      ? (viewCategories ?? OPEN_CATEGORIES).filter((c) => OPEN_CATEGORIES.includes(c))
      : viewCategories
  const after = completedAfter(options.completedIssues, now)
  return {
    sort: options.ordering,
    direction: options.orderDirection,
    showSubIssues: options.showSubIssues,
    ...(categories && { statusCategories: categories }),
    ...(after && { completedAfter: after }),
  }
}

/** The status categories whose empty groups and columns a view still shows. */
export function visibleCategories(
  options: DisplayOptions,
  viewCategories: StatusCategory[] | undefined,
): StatusCategory[] | undefined {
  return displayListInput(options, viewCategories).statusCategories
}

export const GROUPING_OPTIONS: readonly { value: IssueGrouping; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
  { value: 'label', label: 'Label' },
  { value: 'none', label: 'No grouping' },
]

export const ORDERING_OPTIONS: readonly { value: IssueSort; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'createdAt', label: 'Created' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'estimate', label: 'Estimate' },
]

export const COMPLETED_OPTIONS: readonly { value: CompletedIssues; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'day', label: 'Past day' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'none', label: 'None' },
]

export const PROPERTY_LABELS: Record<DisplayProperty, string> = {
  id: 'ID',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  project: 'Project',
  dueDate: 'Due date',
  milestone: 'Milestone',
  labels: 'Labels',
  links: 'Links',
  estimate: 'Estimate',
  createdAt: 'Created',
  updatedAt: 'Updated',
  pullRequests: 'Pull requests',
}
