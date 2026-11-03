import type { Issue, Label, WorkflowStatus } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import {
  groupIssues,
  listOrder,
  nestSubIssues,
  orderCompletedByRecency,
  toListRows,
  uniqueIssues,
  type GroupContext,
} from './group-issues'

const status = (
  name: string,
  category: WorkflowStatus['category'],
  position: number,
): WorkflowStatus => ({ id: crypto.randomUUID(), name, category, position })

const backlog = status('Backlog', 'backlog', 0)
const todo = status('Todo', 'unstarted', 1)
const inProgress = status('In Progress', 'started', 2)
const done = status('Done', 'completed', 3)
const canceled = status('Canceled', 'canceled', 4)

const ada = { id: crypto.randomUUID(), name: 'Ada', avatarUrl: null }
const bob = { id: crypto.randomUUID(), name: 'bob', avatarUrl: null }
const launch = { id: crypto.randomUUID(), name: 'Launch', iconUrl: null }
const api = { id: crypto.randomUUID(), name: 'API', iconUrl: null }
const label = (name: string): Label => ({
  id: crypto.randomUUID(),
  teamId: null,
  name,
  color: '#eb5757',
})
const bug = label('Bug')
const ui = label('UI')

function issue(
  id: string,
  s: WorkflowStatus,
  parentIdOrFields: string | null | Partial<Issue> = null,
): Issue {
  const now = new Date()
  const fields =
    typeof parentIdOrFields === 'object' && parentIdOrFields !== null
      ? parentIdOrFields
      : { parentId: parentIdOrFields }
  return {
    id,
    identifier: `TIP-${id}`,
    number: 1,
    teamId: crypto.randomUUID(),
    title: id,
    description: null,
    status: s,
    priority: 0,
    assigneeId: null,
    creatorId: crypto.randomUUID(),
    projectId: null,
    cycleId: null,
    estimate: null,
    dueDate: null,
    labels: [],
    isSubscribed: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    blockedByCount: 0,
    blockingCount: 0,
    parentId: null,
    subIssueProgress: null,
    ...fields,
  }
}

const ctx: GroupContext = {
  statusesByTeam: new Map([['team', [backlog, todo, inProgress, done, canceled]]]),
  users: [ada, bob],
  projects: [launch, api],
  labels: [bug, ui],
}
const labels = (groups: { label: string }[]) => groups.map((g) => g.label)
const ids = (group: { issues: Issue[] } | undefined) => group?.issues.map((i) => i.id)

describe('groupIssues by status', () => {
  it('orders groups started → unstarted → completed and keeps issue order', () => {
    const groups = groupIssues(
      [issue('a', done), issue('b', todo), issue('c', inProgress), issue('d', todo)],
      { groupBy: 'status' },
    )
    expect(labels(groups)).toEqual(['In Progress', 'Todo', 'Done'])
    expect(ids(groups[1])).toEqual(['b', 'd'])
    expect(groups[0]?.icon).toEqual({ type: 'status', category: 'started' })
    expect(groups[0]?.value).toEqual({ by: 'status', status: inProgress })
  })

  it('merges same-named statuses from different teams', () => {
    const otherTodo = status('Todo', 'unstarted', 1)
    const groups = groupIssues([issue('a', todo), issue('b', otherTodo)], { groupBy: 'status' })
    expect(groups).toHaveLength(1)
    expect(groups[0]?.issues).toHaveLength(2)
  })

  it('reverses the order with direction desc', () => {
    const groups = groupIssues([issue('a', done), issue('b', todo)], {
      groupBy: 'status',
      direction: 'desc',
    })
    expect(labels(groups)).toEqual(['Done', 'Todo'])
  })

  it('shows every status with showEmpty, within the given categories', () => {
    const all = groupIssues([issue('a', todo)], { groupBy: 'status', showEmpty: true }, ctx)
    expect(labels(all)).toEqual(['In Progress', 'Todo', 'Backlog', 'Done', 'Canceled'])
    const open = groupIssues(
      [issue('a', todo)],
      { groupBy: 'status', showEmpty: true },
      { ...ctx, categories: ['backlog', 'unstarted', 'started'] },
    )
    expect(labels(open)).toEqual(['In Progress', 'Todo', 'Backlog'])
  })

  it('uses workflow order for the board', () => {
    const groups = groupIssues([issue('a', inProgress), issue('b', backlog)], {
      groupBy: 'status',
      statusOrder: 'workflow',
    })
    expect(labels(groups)).toEqual(['Backlog', 'In Progress'])
  })
})

describe('groupIssues by priority', () => {
  it('orders Urgent → Low with No priority last, in both directions', () => {
    const list = [0, 4, 1, 3, 2].map((priority) => issue(`p${priority}`, todo, { priority }))
    expect(labels(groupIssues(list, { groupBy: 'priority' }))).toEqual([
      'Urgent',
      'High',
      'Medium',
      'Low',
      'No priority',
    ])
    expect(labels(groupIssues(list, { groupBy: 'priority', direction: 'desc' }))).toEqual([
      'Low',
      'Medium',
      'High',
      'Urgent',
      'No priority',
    ])
  })

  it('lists every priority with showEmpty', () => {
    const groups = groupIssues([issue('a', todo, { priority: 2 })], {
      groupBy: 'priority',
      showEmpty: true,
    })
    expect(groups).toHaveLength(5)
    expect(groups.find((g) => g.label === 'High')?.issues).toHaveLength(1)
    expect(groups.find((g) => g.label === 'Urgent')?.issues).toEqual([])
  })
})

describe('groupIssues by assignee', () => {
  it('names groups after members, A → Z, with No assignee last', () => {
    const groups = groupIssues(
      [
        issue('a', todo),
        issue('b', todo, { assigneeId: bob.id }),
        issue('c', todo, { assigneeId: ada.id }),
      ],
      { groupBy: 'assignee' },
      ctx,
    )
    expect(labels(groups)).toEqual(['Ada', 'bob', 'No assignee'])
    expect(groups[0]?.icon).toEqual({ type: 'user', name: 'Ada', avatarUrl: null })
    expect(groups[2]?.icon).toEqual({ type: 'unassigned' })
    expect(groups[2]?.value).toEqual({ by: 'assignee', assigneeId: null })
  })

  it('keeps No assignee last when reversed, and shows every member with showEmpty', () => {
    const list = [issue('a', todo), issue('b', todo, { assigneeId: ada.id })]
    expect(labels(groupIssues(list, { groupBy: 'assignee', direction: 'desc' }, ctx))).toEqual([
      'Ada',
      'No assignee',
    ])
    expect(labels(groupIssues(list, { groupBy: 'assignee', showEmpty: true }, ctx))).toEqual([
      'Ada',
      'bob',
      'No assignee',
    ])
  })

  it('still groups people the member list does not know', () => {
    const groups = groupIssues([issue('a', todo, { assigneeId: crypto.randomUUID() })], {
      groupBy: 'assignee',
    })
    expect(labels(groups)).toEqual(['Unknown user'])
  })
})

describe('groupIssues by project', () => {
  it('names groups after projects, A → Z, with No project last', () => {
    const groups = groupIssues(
      [
        issue('a', todo),
        issue('b', todo, { projectId: launch.id }),
        issue('c', todo, { projectId: api.id }),
      ],
      { groupBy: 'project', showEmpty: false },
      ctx,
    )
    expect(labels(groups)).toEqual(['API', 'Launch', 'No project'])
    expect(groups[1]?.value).toEqual({ by: 'project', projectId: launch.id })
  })

  it('lists every project with showEmpty', () => {
    const groups = groupIssues([], { groupBy: 'project', showEmpty: true }, ctx)
    expect(labels(groups)).toEqual(['API', 'Launch', 'No project'])
  })
})

describe('groupIssues by label', () => {
  it('puts an issue in each of its labels, and unlabelled ones in No labels', () => {
    const groups = groupIssues(
      [
        issue('a', todo, { labels: [ui, bug] }),
        issue('b', todo, { labels: [ui] }),
        issue('c', todo),
      ],
      { groupBy: 'label' },
      ctx,
    )
    expect(labels(groups)).toEqual(['Bug', 'UI', 'No labels'])
    expect(ids(groups[0])).toEqual(['a'])
    expect(ids(groups[1])).toEqual(['a', 'b'])
    expect(ids(groups[2])).toEqual(['c'])
    expect(groups[0]?.icon).toEqual({ type: 'label', color: bug.color })
  })

  it('renders an issue once per label but visits it once', () => {
    const groups = groupIssues([issue('a', todo, { labels: [ui, bug] })], { groupBy: 'label' })
    const rows = toListRows(groups)
    const issueRows = rows.filter((r) => r.type === 'issue')
    expect(issueRows).toHaveLength(2)
    // Row keys stay unique for the virtualizer.
    expect(new Set(issueRows.map((r) => r.key)).size).toBe(2)
    expect(uniqueIssues(rows).map((i) => i.id)).toEqual(['a'])
    expect(listOrder(groups)).toEqual(['TIP-a'])
  })
})

describe('groupIssues without grouping', () => {
  it('has one group and no header row', () => {
    const groups = groupIssues([issue('a', done), issue('b', todo)], { groupBy: 'none' })
    expect(groups).toHaveLength(1)
    expect(ids(groups[0])).toEqual(['a', 'b'])
    expect(toListRows(groups).map((r) => r.type)).toEqual(['issue', 'issue'])
  })

  it('has no groups without issues', () => {
    expect(groupIssues([], { groupBy: 'none' })).toEqual([])
  })

  it('ignores a sub-grouping', () => {
    const groups = groupIssues([issue('a', todo)], { groupBy: 'none', subGroupBy: 'status' })
    expect(groups[0]?.subGroups).toEqual([])
  })
})

describe('sub-grouping', () => {
  const list = [
    issue('a', todo, { priority: 1 }),
    issue('b', inProgress, { priority: 2 }),
    issue('c', todo, { priority: 2 }),
    issue('d', todo, { priority: 1 }),
  ]

  it('splits each group into its own sub-groups', () => {
    const groups = groupIssues(list, { groupBy: 'status', subGroupBy: 'priority' })
    expect(labels(groups)).toEqual(['In Progress', 'Todo'])
    expect(labels(groups[1]!.subGroups)).toEqual(['Urgent', 'High'])
    expect(ids(groups[1]!.subGroups[0])).toEqual(['a', 'd'])
    // Keys include the parent so collapsing one sub-group leaves its twins alone.
    expect(groups[1]!.subGroups[0]!.key).toBe(`${groups[1]!.key}>priority:1`)
  })

  it('renders group, sub-group and issue rows, and collapses either level', () => {
    const groups = groupIssues(list, { groupBy: 'status', subGroupBy: 'priority' })
    const shape = (collapsed?: Set<string>) =>
      toListRows(groups, collapsed).map((r) =>
        r.type === 'group' ? `${r.depth}:${r.group.label}` : r.issue.id,
      )
    expect(shape()).toEqual([
      '0:In Progress',
      '1:High',
      'b',
      '0:Todo',
      '1:Urgent',
      'a',
      'd',
      '1:High',
      'c',
    ])
    expect(shape(new Set([groups[1]!.key]))).toEqual(['0:In Progress', '1:High', 'b', '0:Todo'])
    expect(shape(new Set([groups[1]!.subGroups[0]!.key]))).toEqual([
      '0:In Progress',
      '1:High',
      'b',
      '0:Todo',
      '1:Urgent',
      '1:High',
      'c',
    ])
  })

  it('never repeats the grouping, and only lists sub-groups with issues', () => {
    expect(groupIssues(list, { groupBy: 'status', subGroupBy: 'status' })[0]?.subGroups).toEqual([])
    const groups = groupIssues(
      list,
      { groupBy: 'status', subGroupBy: 'priority', showEmpty: true },
      ctx,
    )
    expect(labels(groups.find((g) => g.label === 'Todo')!.subGroups)).toEqual(['Urgent', 'High'])
    expect(groups.find((g) => g.label === 'Backlog')!.subGroups).toEqual([])
  })

  it('sub-groups by label with multi-membership', () => {
    const groups = groupIssues([issue('a', todo, { labels: [bug, ui] }), issue('b', todo)], {
      groupBy: 'status',
      subGroupBy: 'label',
    })
    expect(labels(groups[0]!.subGroups)).toEqual(['Bug', 'UI', 'No labels'])
    expect(listOrder(groups)).toEqual(['TIP-a', 'TIP-b'])
  })
})

describe('ordering completed by recency', () => {
  const day = 24 * 60 * 60 * 1000
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * day)
  const list = [
    issue('old', done, { completedAt: at(5) }),
    issue('open', todo),
    issue('new', done, { completedAt: at(1) }),
    // Canceled issues have no completedAt; their last update counts.
    issue('x', canceled, { updatedAt: at(3) }),
  ]

  it('puts open issues first, then finished ones newest first', () => {
    expect(orderCompletedByRecency(list).map((i) => i.id)).toEqual(['open', 'new', 'x', 'old'])
  })

  it('applies within each group', () => {
    const groups = groupIssues(list, { groupBy: 'none', ordering: { completedByRecency: true } })
    expect(ids(groups[0])).toEqual(['open', 'new', 'x', 'old'])
    const byStatus = groupIssues(list, { groupBy: 'status' })
    expect(ids(byStatus.find((g) => g.label === 'Done'))).toEqual(['old', 'new'])
    const recent = groupIssues(list, { groupBy: 'status', ordering: { completedByRecency: true } })
    expect(ids(recent.find((g) => g.label === 'Done'))).toEqual(['new', 'old'])
  })
})

describe('toListRows', () => {
  it('puts a header row before each group', () => {
    const rows = toListRows(
      groupIssues([issue('a', todo), issue('b', done)], { groupBy: 'status' }),
    )
    expect(rows.map((r) => r.type)).toEqual(['group', 'issue', 'group', 'issue'])
  })

  it('hides the issues of collapsed groups', () => {
    const groups = groupIssues([issue('a', todo), issue('b', done)], { groupBy: 'status' })
    const rows = toListRows(groups, new Set([groups[0]!.key]))
    expect(rows.map((r) => r.type)).toEqual(['group', 'group', 'issue'])
  })

  it('keeps empty groups as headers only', () => {
    const groups = groupIssues([issue('a', todo)], { groupBy: 'priority', showEmpty: true })
    expect(toListRows(groups).map((r) => r.type)).toEqual([
      'group',
      'group',
      'group',
      'group',
      'group',
      'issue',
    ])
  })
})

describe('nestSubIssues', () => {
  const nested = (issues: Issue[]) => nestSubIssues(issues).map((r) => `${r.issue.id}:${r.depth}`)

  it('puts sub-issues right after their parent, recursively', () => {
    expect(
      nested([
        issue('c', todo, 'a'),
        issue('a', todo),
        issue('b', todo),
        issue('d', todo, 'c'),
        issue('e', todo, 'a'),
      ]),
    ).toEqual(['a:0', 'c:1', 'd:2', 'e:1', 'b:0'])
  })

  it('keeps sub-issues whose parent is not in the list at the top level', () => {
    expect(nested([issue('a', todo, 'missing'), issue('b', todo)])).toEqual(['a:0', 'b:0'])
  })

  it('never drops issues, even with a cycle in the data', () => {
    expect(nested([issue('a', todo, 'b'), issue('b', todo, 'a')])).toHaveLength(2)
  })

  it('nests within each status group', () => {
    const rows = toListRows(
      groupIssues([issue('p', todo), issue('c', todo, 'p'), issue('x', done, 'p')], {
        groupBy: 'status',
      }),
    )
    expect(rows.flatMap((r) => (r.type === 'issue' ? [`${r.issue.id}:${r.depth}`] : []))).toEqual([
      'p:0',
      'c:1',
      'x:0',
    ])
  })
})

describe('listOrder', () => {
  it('lists identifiers group by group, as rendered, skipping collapsed groups', () => {
    const groups = groupIssues(
      [issue('a', done), issue('b', todo), issue('c', inProgress), issue('d', todo)],
      { groupBy: 'status' },
    )
    expect(listOrder(groups)).toEqual(['TIP-c', 'TIP-b', 'TIP-d', 'TIP-a'])
    expect(listOrder(groups, new Set([groups[1]!.key]))).toEqual(['TIP-c', 'TIP-a'])
  })
})
