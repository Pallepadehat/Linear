import type { Issue, WorkflowStatus } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { resolveDropTarget, toBoardColumns } from './board-columns'

const status = (
  name: string,
  category: WorkflowStatus['category'],
  position: number,
): WorkflowStatus => ({ id: crypto.randomUUID(), name, category, position })

const teamA = crypto.randomUUID()
const teamB = crypto.randomUUID()
const backlog = status('Backlog', 'backlog', 0)
const todo = status('Todo', 'unstarted', 1)
const inProgress = status('In Progress', 'started', 2)
const inReview = status('In Review', 'started', 3)
const done = status('Done', 'completed', 4)

function issue(id: string, s: WorkflowStatus, teamId = teamA): Issue {
  const now = new Date()
  return {
    id,
    identifier: `TIP-${id}`,
    number: 1,
    teamId,
    title: id,
    description: null,
    status: s,
    priority: 0,
    assigneeId: null,
    creatorId: crypto.randomUUID(),
    projectId: null,
    dueDate: null,
    labels: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

describe('toBoardColumns', () => {
  it('has a column for every team status in workflow order, empty ones included', () => {
    const columns = toBoardColumns(
      [issue('a', done), issue('b', todo), issue('c', todo)],
      new Map([[teamA, [done, inReview, todo, backlog, inProgress]]]),
    )
    expect(columns.map((c) => c.status.name)).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'In Review',
      'Done',
    ])
    expect(columns[1]?.issues.map((i) => i.id)).toEqual(['b', 'c'])
    expect(columns[0]?.issues).toEqual([])
  })

  it('merges same-named statuses of different teams into one column', () => {
    const otherTodo = status('Todo', 'unstarted', 1)
    const columns = toBoardColumns(
      [issue('a', todo), issue('b', otherTodo, teamB)],
      new Map([
        [teamA, [todo]],
        [teamB, [otherTodo]],
      ]),
    )
    expect(columns).toHaveLength(1)
    expect(columns[0]?.issues.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('still shows issues whose team statuses have not loaded', () => {
    const columns = toBoardColumns([issue('a', inProgress)], new Map())
    expect(columns.map((c) => c.status.name)).toEqual(['In Progress'])
  })
})

describe('resolveDropTarget', () => {
  it("moves to the issue's own team's status for the column", () => {
    const otherDone = status('Done', 'completed', 4)
    expect(resolveDropTarget(issue('a', todo, teamB), 'completed:Done', [todo, otherDone])).toEqual(
      { type: 'move', status: otherDone },
    )
  })

  it('ignores a drop on the current column', () => {
    expect(resolveDropTarget(issue('a', todo), 'unstarted:Todo', [todo, done])).toEqual({
      type: 'same',
    })
  })

  it("rejects a column the issue's team has no status for", () => {
    expect(resolveDropTarget(issue('a', todo), 'started:In Review', [todo, done])).toEqual({
      type: 'unavailable',
    })
    expect(resolveDropTarget(issue('a', todo), 'completed:Done', undefined)).toEqual({
      type: 'unavailable',
    })
  })
})
