import type { Issue, WorkflowStatus } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { groupIssuesByStatus, toListRows } from './group-issues'

const status = (
  name: string,
  category: WorkflowStatus['category'],
  position: number,
): WorkflowStatus => ({ id: crypto.randomUUID(), name, category, position })

const todo = status('Todo', 'unstarted', 1)
const inProgress = status('In Progress', 'started', 2)
const done = status('Done', 'completed', 3)

function issue(id: string, s: WorkflowStatus): Issue {
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
    cycleId: null,
    labels: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
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
