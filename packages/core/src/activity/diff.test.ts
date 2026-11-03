import { describe, expect, it } from 'vitest'
import { diffIssue, type IssueSnapshot } from './diff'

const current: IssueSnapshot = {
  title: 'Fix login',
  description: 'Steps',
  statusId: 'todo',
  priority: 0,
  assigneeId: null,
  projectId: null,
  estimate: null,
  labelIds: ['bug', 'ui'],
  dueDate: null,
}

describe('diffIssue', () => {
  it('returns nothing when no field is given', () => {
    expect(diffIssue(current, {})).toEqual([])
  })

  it('returns nothing when every field is set to the value it already had', () => {
    expect(diffIssue(current, { ...current, labelIds: ['ui', 'bug', 'ui'] })).toEqual([])
  })

  it('returns one change per changed field with from and to', () => {
    expect(
      diffIssue(current, {
        title: 'Fix sign-in',
        statusId: 'done',
        priority: 2,
        assigneeId: 'u1',
        projectId: null,
      }),
    ).toEqual([
      { kind: 'title', from: 'Fix login', to: 'Fix sign-in' },
      { kind: 'status', from: 'todo', to: 'done' },
      { kind: 'priority', from: 0, to: 2 },
      { kind: 'assignee', from: null, to: 'u1' },
    ])
  })

  it('records estimate changes, including clearing one', () => {
    expect(diffIssue(current, { estimate: 3 })).toEqual([{ kind: 'estimate', from: null, to: 3 }])
    expect(diffIssue({ ...current, estimate: 3 }, { estimate: null })).toEqual([
      { kind: 'estimate', from: 3, to: null },
    ])
  })

  it('records a description change without its text', () => {
    expect(diffIssue(current, { description: null })).toEqual([
      { kind: 'description', from: null, to: null },
    ])
  })

  it('compares labels as sorted sets', () => {
    expect(diffIssue(current, { labelIds: ['ui', 'feature'] })).toEqual([
      { kind: 'labels', from: ['bug', 'ui'], to: ['feature', 'ui'] },
    ])
  })

  it('records due date changes as days, set and cleared', () => {
    expect(diffIssue(current, { dueDate: '2026-11-07' })).toEqual([
      { kind: 'due_date', from: null, to: '2026-11-07' },
    ])
    expect(diffIssue({ ...current, dueDate: '2026-11-07' }, { dueDate: null })).toEqual([
      { kind: 'due_date', from: '2026-11-07', to: null },
    ])
  })
})
