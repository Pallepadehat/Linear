import type { Issue, WorkflowStatus } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { boardOrder, resolveDropTarget, toBoardColumns } from './board-columns'

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

function issue(id: string, s: WorkflowStatus, teamId = teamA, fields: Partial<Issue> = {}): Issue {
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
    project: null,
    pullRequests: [],
    linkCount: 0,
    parentId: null,
    subIssueProgress: null,
    ...fields,
  }
}

const statuses = (map: [string, WorkflowStatus[]][]) => ({ statusesByTeam: new Map(map) })
const names = (columns: { label: string }[]) => columns.map((c) => c.label)
const column = (key: string, s: WorkflowStatus) => ({
  key,
  value: { by: 'status' as const, status: s },
})

describe('toBoardColumns', () => {
  it('has a column for every team status in workflow order, empty ones included', () => {
    const columns = toBoardColumns(
      [issue('a', done), issue('b', todo), issue('c', todo)],
      statuses([[teamA, [done, inReview, todo, backlog, inProgress]]]),
    )
    expect(names(columns)).toEqual(['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'])
    expect(columns[1]?.issues.map((i) => i.id)).toEqual(['b', 'c'])
    expect(columns[0]?.issues).toEqual([])
  })

  it('merges same-named statuses of different teams into one column', () => {
    const otherTodo = status('Todo', 'unstarted', 1)
    const columns = toBoardColumns(
      [issue('a', todo), issue('b', otherTodo, teamB)],
      statuses([
        [teamA, [todo]],
        [teamB, [otherTodo]],
      ]),
    )
    expect(columns).toHaveLength(1)
    expect(columns[0]?.issues.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it("leaves out empty columns outside the view's categories", () => {
    const ctx = statuses([[teamA, [backlog, todo, inProgress, done]]])
    const active = toBoardColumns([issue('a', todo)], {
      ...ctx,
      categories: ['started', 'unstarted'],
    })
    expect(names(active)).toEqual(['Todo', 'In Progress'])
    // An issue moved out of the view keeps its column until the list refetches.
    const moved = toBoardColumns([issue('a', done)], { ...ctx, categories: ['backlog'] })
    expect(names(moved)).toEqual(['Backlog', 'Done'])
  })

  it('still shows issues whose team statuses have not loaded', () => {
    const columns = toBoardColumns([issue('a', inProgress)], statuses([]))
    expect(names(columns)).toEqual(['In Progress'])
  })

  it('follows the grouping: one column per priority, assignee, project or label', () => {
    const ada = { id: crypto.randomUUID(), name: 'Ada', avatarUrl: null }
    const list = [
      issue('a', todo, teamA, { priority: 1, assigneeId: ada.id }),
      issue('b', todo, teamA, { priority: 3 }),
    ]
    expect(names(toBoardColumns(list, { users: [ada] }, { groupBy: 'priority' }))).toEqual([
      'Urgent',
      'Medium',
    ])
    expect(names(toBoardColumns(list, { users: [ada] }, { groupBy: 'assignee' }))).toEqual([
      'Ada',
      'No assignee',
    ])
    // Other groupings show empty columns only with "Show empty groups".
    expect(
      toBoardColumns(list, {}, { groupBy: 'priority', showEmpty: true }).map(
        (c) => c.issues.length,
      ),
    ).toEqual([1, 0, 1, 0, 0])
    expect(names(toBoardColumns(list, {}, { groupBy: 'none' }))).toEqual(['All issues'])
  })
})

describe('resolveDropTarget', () => {
  it("moves to the issue's own team's status for the column", () => {
    const otherDone = status('Done', 'completed', 4)
    expect(
      resolveDropTarget(issue('a', todo, teamB), column('completed:Done', done), [todo, otherDone]),
    ).toEqual({ type: 'move', patch: { status: otherDone } })
  })

  it('ignores a drop on the current column', () => {
    expect(
      resolveDropTarget(issue('a', todo), column('unstarted:Todo', todo), [todo, done]),
    ).toEqual({ type: 'same' })
  })

  it("rejects a column the issue's team has no status for", () => {
    expect(
      resolveDropTarget(issue('a', todo), column('started:In Review', inReview), [todo, done]),
    ).toEqual({ type: 'unavailable' })
    expect(resolveDropTarget(issue('a', todo), column('completed:Done', done), undefined)).toEqual({
      type: 'unavailable',
    })
  })

  it('sets priority, assignee or project on other columns; labels take no drops', () => {
    const [high, noOne, launch, bug] = toBoardColumns(
      [issue('a', todo, teamA, { priority: 2 }), issue('b', todo, teamA, { assigneeId: null })],
      {},
      { groupBy: 'priority' },
    )
      .slice(0, 1)
      .concat(
        toBoardColumns([issue('b', todo)], {}, { groupBy: 'assignee' }),
        toBoardColumns(
          [issue('c', todo, teamA, { projectId: crypto.randomUUID() })],
          {},
          {
            groupBy: 'project',
          },
        ),
        toBoardColumns(
          [
            issue('d', todo, teamA, {
              labels: [{ id: crypto.randomUUID(), teamId: null, name: 'Bug', color: '#eb5757' }],
            }),
          ],
          {},
          { groupBy: 'label' },
        ),
      )
    const me = crypto.randomUUID()
    const card = issue('x', todo, teamA, { priority: 4, assigneeId: me })
    expect(resolveDropTarget(card, high!, [])).toEqual({ type: 'move', patch: { priority: 2 } })
    expect(resolveDropTarget(card, noOne!, [])).toEqual({
      type: 'move',
      patch: { assigneeId: null },
    })
    expect(resolveDropTarget(issue('y', todo, teamA, { priority: 2 }), high!, [])).toEqual({
      type: 'same',
    })
    expect(resolveDropTarget(card, launch!, [])).toMatchObject({ type: 'move' })
    expect(resolveDropTarget(card, bug!, [])).toEqual({ type: 'unavailable' })
  })
})

describe('boardOrder', () => {
  it('lists identifiers column by column in workflow order', () => {
    const issues = [issue('a', done), issue('b', todo), issue('c', backlog), issue('d', todo)]
    const columns = toBoardColumns(issues, statuses([[teamA, [backlog, todo, inProgress, done]]]))
    expect(boardOrder(columns)).toEqual(['TIP-c', 'TIP-b', 'TIP-d', 'TIP-a'])
  })

  it('lists an issue in several label columns once', () => {
    const label = (name: string) => ({ id: crypto.randomUUID(), teamId: null, name, color: '#000' })
    const columns = toBoardColumns(
      [issue('a', todo, teamA, { labels: [label('Bug'), label('UI')] })],
      {},
      { groupBy: 'label' },
    )
    expect(columns).toHaveLength(2)
    expect(boardOrder(columns)).toEqual(['TIP-a'])
  })
})
