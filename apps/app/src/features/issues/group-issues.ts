import type {
  Issue,
  IssueGrouping,
  Label,
  SortDirection,
  StatusCategory,
  WorkflowStatus,
} from '@linear/contract'
import { toPriority, type Priority } from '@/lib/priorities'

// Active work first, like Linear's list view; finished work sinks to the bottom.
export const CATEGORY_ORDER: Record<StatusCategory, number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  canceled: 4,
}

// Board columns read left to right through the workflow, like Linear's board.
export const WORKFLOW_ORDER: Record<StatusCategory, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  canceled: 4,
}

/** How a group header or column is drawn; the color comes from the matching token. */
export type GroupIcon =
  | { type: 'status'; category: StatusCategory }
  | { type: 'priority'; priority: Priority }
  | { type: 'user'; name: string; avatarUrl: string | null }
  | { type: 'unassigned' }
  | { type: 'project'; iconUrl: string | null }
  | { type: 'label'; color: string }
  | { type: 'none' }

/** What an issue created in, or dropped on, a group gets. */
export type GroupValue =
  | { by: 'status'; status: WorkflowStatus }
  | { by: 'priority'; priority: Priority }
  | { by: 'assignee'; assigneeId: string | null }
  | { by: 'project'; projectId: string | null }
  | { by: 'label'; labelId: string | null }
  | { by: 'none' }

export type IssueGroup = {
  key: string
  label: string
  icon: GroupIcon
  value: GroupValue
  issues: Issue[]
  /** Empty without a sub-grouping. */
  subGroups: IssueGroup[]
}

/** The people, projects and labels groups are named after, and the empty groups to show. */
export type GroupContext = {
  statusesByTeam?: ReadonlyMap<string, WorkflowStatus[]>
  /** Categories empty status groups may come from (a view tab, "Completed issues: None"). */
  categories?: StatusCategory[]
  users?: readonly { id: string; name: string; avatarUrl?: string | null }[]
  projects?: readonly { id: string; name: string; iconUrl: string | null }[]
  labels?: readonly Pick<Label, 'id' | 'name' | 'color'>[]
}

export type GroupOptions = {
  groupBy: IssueGrouping
  subGroupBy?: IssueGrouping
  /** `asc` is the natural order; "No assignee" / "No project" / … stay last either way. */
  direction?: SortDirection
  /** Also lists groups no loaded issue is in (every status, member, project, …). */
  showEmpty?: boolean
  ordering?: { completedByRecency?: boolean }
  /** Status groups active-first (list) or backlog-first (board). */
  statusOrder?: 'list' | 'workflow'
}

export type IssueListRow =
  | { type: 'group'; key: string; group: IssueGroup; depth: number }
  | { type: 'issue'; key: string; issue: Issue; depth: number }

/** Groups the same-named status of different teams together (e.g. every team's "Todo"). */
export const statusGroupKey = (status: Pick<WorkflowStatus, 'category' | 'name'>) =>
  `${status.category}:${status.name}`

// A group before ordering: `rank` sorts it, `last` pins "No …" groups to the end.
type Bucket = Omit<IssueGroup, 'issues' | 'subGroups'> & {
  rank: (number | string)[]
  last?: boolean
}

const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

function statusBucket(status: WorkflowStatus, order: Record<StatusCategory, number>): Bucket {
  return {
    key: statusGroupKey(status),
    label: status.name,
    icon: { type: 'status', category: status.category },
    value: { by: 'status', status },
    rank: [order[status.category], status.position],
  }
}

function priorityBucket(value: number): Bucket {
  const priority = toPriority(value)
  return {
    key: `priority:${priority}`,
    label: PRIORITY_LABELS[priority],
    icon: { type: 'priority', priority },
    value: { by: 'priority', priority },
    rank: [priority],
    last: priority === 0,
  }
}

const byName = (name: string) => name.toLocaleLowerCase()

function assigneeBucket(id: string | null, ctx: GroupContext): Bucket {
  if (!id)
    return {
      key: 'assignee:none',
      label: 'No assignee',
      icon: { type: 'unassigned' },
      value: { by: 'assignee', assigneeId: null },
      rank: [],
      last: true,
    }
  const user = ctx.users?.find((u) => u.id === id)
  const name = user?.name ?? 'Unknown user'
  return {
    key: `assignee:${id}`,
    label: name,
    icon: { type: 'user', name, avatarUrl: user?.avatarUrl ?? null },
    value: { by: 'assignee', assigneeId: id },
    rank: [byName(name)],
  }
}

function projectBucket(id: string | null, ctx: GroupContext): Bucket {
  const project = id ? ctx.projects?.find((p) => p.id === id) : undefined
  const name = id ? (project?.name ?? 'Unknown project') : 'No project'
  return {
    key: `project:${id ?? 'none'}`,
    label: name,
    icon: id ? { type: 'project', iconUrl: project?.iconUrl ?? null } : { type: 'none' },
    value: { by: 'project', projectId: id },
    rank: [byName(name)],
    last: !id,
  }
}

function labelBucket(label: Pick<Label, 'id' | 'name' | 'color'> | null): Bucket {
  return label
    ? {
        key: `label:${label.id}`,
        label: label.name,
        icon: { type: 'label', color: label.color },
        value: { by: 'label', labelId: label.id },
        rank: [byName(label.name)],
      }
    : {
        key: 'label:none',
        label: 'No labels',
        icon: { type: 'none' },
        value: { by: 'label', labelId: null },
        rank: [],
        last: true,
      }
}

const ALL_BUCKET: Bucket = {
  key: 'all',
  label: 'All issues',
  icon: { type: 'none' },
  value: { by: 'none' },
  rank: [],
}

/** The groups an issue is in: one, except for labels (one per label, or "No labels"). */
function bucketsOf(issue: Issue, options: Required<GroupOptions>, ctx: GroupContext): Bucket[] {
  const order = options.statusOrder === 'workflow' ? WORKFLOW_ORDER : CATEGORY_ORDER
  switch (options.groupBy) {
    case 'status':
      return [statusBucket(issue.status, order)]
    case 'priority':
      return [priorityBucket(issue.priority)]
    case 'assignee':
      return [assigneeBucket(issue.assigneeId, ctx)]
    case 'project':
      return [projectBucket(issue.projectId, ctx)]
    case 'label':
      return issue.labels.length ? issue.labels.map(labelBucket) : [labelBucket(null)]
    case 'none':
      return [ALL_BUCKET]
  }
}

/** Every group the grouping can have, for "Show empty groups" and drop targets. */
function allBuckets(options: Required<GroupOptions>, ctx: GroupContext): Bucket[] {
  const order = options.statusOrder === 'workflow' ? WORKFLOW_ORDER : CATEGORY_ORDER
  switch (options.groupBy) {
    case 'status':
      return [...(ctx.statusesByTeam?.values() ?? [])]
        .flat()
        .filter((s) => !ctx.categories || ctx.categories.includes(s.category))
        .map((s) => statusBucket(s, order))
    case 'priority':
      return [0, 1, 2, 3, 4].map(priorityBucket)
    case 'assignee':
      return [null, ...(ctx.users ?? []).map((u) => u.id)].map((id) => assigneeBucket(id, ctx))
    case 'project':
      return [null, ...(ctx.projects ?? []).map((p) => p.id)].map((id) => projectBucket(id, ctx))
    case 'label':
      return [null, ...(ctx.labels ?? [])].map(labelBucket)
    case 'none':
      return [ALL_BUCKET]
  }
}

function compareRank(a: Bucket, b: Bucket) {
  for (let i = 0; i < Math.max(a.rank.length, b.rank.length); i++) {
    const x = a.rank[i]
    const y = b.rank[i]
    if (x === y) continue
    if (x === undefined) return -1
    if (y === undefined) return 1
    return typeof x === 'number' && typeof y === 'number'
      ? x - y
      : String(x).localeCompare(String(y))
  }
  return 0
}

const isFinished = (issue: Issue) =>
  issue.status.category === 'completed' || issue.status.category === 'canceled'
// Canceled issues have no `completedAt`; their last update stands in (domain.md).
const finishedAt = (issue: Issue) => (issue.completedAt ?? issue.updatedAt).getTime()

/** Open issues in list order, then finished ones, most recently finished first. */
export function orderCompletedByRecency(issues: Issue[]): Issue[] {
  const open = issues.filter((issue) => !isFinished(issue))
  const finished = issues.filter(isFinished).sort((a, b) => finishedAt(b) - finishedAt(a))
  return [...open, ...finished]
}

/**
 * Groups the loaded issues for the list and the board. Issues keep the list's
 * order within a group (the server sort), except that "Order completed by
 * recency" moves finished issues after open ones. Status groups are keyed by
 * category + name, so the workspace-wide list merges each team's "Todo".
 */
export function groupIssues(
  issues: Issue[],
  options: GroupOptions,
  ctx: GroupContext = {},
): IssueGroup[] {
  const opts: Required<GroupOptions> = {
    subGroupBy: 'none',
    direction: 'asc',
    showEmpty: false,
    ordering: {},
    statusOrder: 'list',
    ...options,
  }
  const ordered = opts.ordering.completedByRecency ? orderCompletedByRecency(issues) : issues

  const groups = new Map<string, Bucket & { issues: Issue[] }>()
  const add = (bucket: Bucket) => {
    let group = groups.get(bucket.key)
    if (!group) groups.set(bucket.key, (group = { ...bucket, issues: [] }))
    return group
  }
  if (opts.showEmpty) for (const bucket of allBuckets(opts, ctx)) add(bucket)
  for (const issue of ordered)
    for (const bucket of bucketsOf(issue, opts, ctx)) add(bucket).issues.push(issue)

  const sorted = [...groups.values()].filter((g) => opts.showEmpty || g.issues.length)
  const main = sorted.filter((g) => !g.last).sort(compareRank)
  if (opts.direction === 'desc') main.reverse()
  const subGroupBy = opts.subGroupBy === opts.groupBy ? 'none' : opts.subGroupBy

  return [...main, ...sorted.filter((g) => g.last).sort(compareRank)].map(
    ({ rank: _rank, last: _last, ...group }): IssueGroup => ({
      ...group,
      subGroups:
        subGroupBy === 'none' || opts.groupBy === 'none'
          ? []
          : groupIssues(
              group.issues,
              { ...opts, groupBy: subGroupBy, subGroupBy: 'none', showEmpty: false, ordering: {} },
              ctx,
            ).map((sub) => ({ ...sub, key: `${group.key}>${sub.key}` })),
    }),
  )
}

/**
 * Puts each sub-issue right after its parent (depth + 1) when the parent is in the
 * same list, keeping the list's order among siblings. Sub-issues whose parent isn't
 * there (another group, not loaded, filtered out) stay at the top level.
 */
export function nestSubIssues(issues: Issue[]): { issue: Issue; depth: number }[] {
  const ids = new Set(issues.map((issue) => issue.id))
  const children = new Map<string, Issue[]>()
  for (const issue of issues) {
    if (!issue.parentId || !ids.has(issue.parentId)) continue
    const siblings = children.get(issue.parentId)
    if (siblings) siblings.push(issue)
    else children.set(issue.parentId, [issue])
  }
  const out: { issue: Issue; depth: number }[] = []
  const placed = new Set<string>()
  const visit = (issue: Issue, depth: number) => {
    if (placed.has(issue.id)) return
    placed.add(issue.id)
    out.push({ issue, depth })
    for (const child of children.get(issue.id) ?? []) visit(child, depth + 1)
  }
  for (const issue of issues) {
    if (!issue.parentId || !ids.has(issue.parentId)) visit(issue, 0)
  }
  // Only reachable if the data had a cycle; never drop an issue.
  for (const issue of issues) visit(issue, 0)
  return out
}

/**
 * Flattens groups into header + issue rows for the virtualizer; collapsed groups
 * keep only their header. "No grouping" has no header. Issue row keys include the
 * group, since label grouping lists an issue once per label.
 */
export function toListRows(
  groups: IssueGroup[],
  collapsed: ReadonlySet<string> = new Set(),
  depth = 0,
): IssueListRow[] {
  return groups.flatMap((group): IssueListRow[] => {
    const header: IssueListRow[] =
      group.value.by === 'none' ? [] : [{ type: 'group', key: `group:${group.key}`, group, depth }]
    if (collapsed.has(group.key)) return header
    if (group.subGroups.length) return [...header, ...toListRows(group.subGroups, collapsed, 1)]
    return [
      ...header,
      ...nestSubIssues(group.issues).map(({ issue, depth: nesting }): IssueListRow => ({
        type: 'issue',
        key: `${group.key}/${issue.id}`,
        issue,
        depth: nesting,
      })),
    ]
  })
}

/** Each issue once, in the order the rows show it (first appearance wins). */
export function uniqueIssues(rows: IssueListRow[]): Issue[] {
  const seen = new Set<string>()
  return rows.flatMap((row) => {
    if (row.type !== 'issue' || seen.has(row.issue.id)) return []
    seen.add(row.issue.id)
    return [row.issue]
  })
}

/** Issue identifiers in list order as rendered: by group, skipping collapsed groups. */
export const listOrder = (groups: IssueGroup[], collapsed: ReadonlySet<string> = new Set()) =>
  uniqueIssues(toListRows(groups, collapsed)).map((issue) => issue.identifier)
