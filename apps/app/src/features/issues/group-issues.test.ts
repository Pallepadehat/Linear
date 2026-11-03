import type { Issue, WorkflowStatus } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { groupIssuesByStatus, listOrder, nestSubIssues, toListRows } from './group-issues'

const status = (
  name: string,
  category: WorkflowStatus['category'],
  position: number,
): WorkflowStatus => ({ id: crypto.randomUUID(), name, category, position })

const todo = status('Todo', 'unstarted', 1)
const inProgress = status('In Progress', 'started', 2)
const done = status('Done', 'completed', 3)

function issue(id: string, s: WorkflowStatus, parentId: string | null = null): Issue {
  const now = new Date()
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
    estimate: null,
    dueDate: null,
    labels: [],
    isSubscribed: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    parentId,
    subIssueProgress: null,
  }
}

describe('groupIssuesByStatus', () => {
  it('orders groups started → unstarted → completed and keeps issue order', () => {
    const groups = groupIssuesByStatus([
      issue('a', done),
      issue('b', todo),
      issue('c', inProgress),
      issue('d', todo),
    ])
    expect(groups.map((g) => g.status.name)).toEqual(['In Progress', 'Todo', 'Done'])
    expect(groups[1]?.issues.map((i) => i.id)).toEqual(['b', 'd'])
  })

  it('merges same-named statuses from different teams', () => {
    const otherTodo = status('Todo', 'unstarted', 1)
    const groups = groupIssuesByStatus([issue('a', todo), issue('b', otherTodo)])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.issues).toHaveLength(2)
  })
})

describe('toListRows', () => {
  it('puts a header row before each group', () => {
    const rows = toListRows(groupIssuesByStatus([issue('a', todo), issue('b', done)]))
    expect(rows.map((r) => r.type)).toEqual(['group', 'issue', 'group', 'issue'])
  })

  it('hides the issues of collapsed groups', () => {
    const groups = groupIssuesByStatus([issue('a', todo), issue('b', done)])
    const rows = toListRows(groups, new Set([groups[0]!.key]))
    expect(rows.map((r) => r.type)).toEqual(['group', 'group', 'issue'])
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
      groupIssuesByStatus([issue('p', todo), issue('c', todo, 'p'), issue('x', done, 'p')]),
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
    const issues = [issue('a', done), issue('b', todo), issue('c', inProgress), issue('d', todo)]
    expect(listOrder(issues)).toEqual(['TIP-c', 'TIP-b', 'TIP-d', 'TIP-a'])
    const todoKey = groupIssuesByStatus(issues)[1]!.key
    expect(listOrder(issues, new Set([todoKey]))).toEqual(['TIP-c', 'TIP-a'])
  })
})
