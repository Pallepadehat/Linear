import type { Issue } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { issuePrefill, prefillFrom, type PrefillContext, type PrefillValues } from './prefill'

const statuses = [
  { id: 'backlog', category: 'backlog' as const, position: 0 },
  { id: 'todo', category: 'unstarted' as const, position: 1 },
  { id: 'doing', category: 'started' as const, position: 2 },
  { id: 'review', category: 'started' as const, position: 3 },
]

const base: PrefillValues = {
  title: '',
  description: '',
  statusId: 'backlog',
  priority: 0,
  assigneeId: null,
  projectId: null,
  labelIds: [],
}

const ctx = (overrides: Partial<PrefillContext> = {}): PrefillContext => ({
  current: base,
  base,
  dirty: new Set(),
  statuses,
  ...overrides,
})

const bugTemplate = {
  title: 'Bug: ',
  description: '## Steps',
  statusId: 'todo',
  statusCategory: 'unstarted' as const,
  priority: 2,
  assigneeId: 'u1',
  projectId: 'p1',
  labelIds: ['l1'],
}

describe('prefillFrom', () => {
  it('fills every untouched field from the source', () => {
    expect(prefillFrom(bugTemplate, ctx())).toEqual({
      title: 'Bug: ',
      description: '## Steps',
      statusId: 'todo',
      priority: 2,
      assigneeId: 'u1',
      projectId: 'p1',
      labelIds: ['l1'],
    })
  })

  it('never overwrites a field the user changed', () => {
    const current = { ...base, title: 'Login fails', priority: 1, labelIds: ['l9'] }
    const result = prefillFrom(
      bugTemplate,
      ctx({ current, dirty: new Set(['title', 'priority', 'labelIds']) }),
    )
    expect(result).toMatchObject({ title: 'Login fails', priority: 1, labelIds: ['l9'] })
    expect(result).toMatchObject({ description: '## Steps', statusId: 'todo', assigneeId: 'u1' })
  })

  it('falls back to the base for values the source leaves empty', () => {
    const teamBase = { ...base, priority: 3, assigneeId: 'lead' }
    expect(
      prefillFrom(
        { title: '', description: null, priority: null, assigneeId: null, labelIds: [] },
        ctx({ base: teamBase }),
      ),
    ).toEqual(teamBase)
  })

  it('resets what a previous template filled when "No template" is picked', () => {
    const filled = prefillFrom(bugTemplate, ctx())
    expect(prefillFrom(null, ctx({ current: filled }))).toEqual(base)
  })

  it('resolves a status from another team by category, first by position', () => {
    expect(prefillFrom({ statusId: 'elsewhere', statusCategory: 'started' }, ctx()).statusId).toBe(
      'doing',
    )
    expect(
      prefillFrom({ statusId: 'elsewhere', statusCategory: 'completed' }, ctx()).statusId,
    ).toBe('backlog')
  })

  it('drops a hand-picked status that is not in the current team', () => {
    const current = { ...base, statusId: 'other-team-status' }
    expect(prefillFrom(bugTemplate, ctx({ current, dirty: new Set(['statusId']) })).statusId).toBe(
      'todo',
    )
  })

  it('skips an assignee who is no longer a member', () => {
    expect(prefillFrom(bugTemplate, ctx({ memberIds: ['u2'] })).assigneeId).toBeNull()
    expect(prefillFrom(bugTemplate, ctx({ memberIds: ['u1'] })).assigneeId).toBe('u1')
  })
})

describe('issuePrefill', () => {
  it('copies the issue as "Copy of …" with its properties', () => {
    const issue = {
      title: 'Fix login',
      description: 'Details',
      status: { id: 'doing', name: 'In Progress', category: 'started', position: 2 },
      priority: 1,
      assigneeId: 'u1',
      projectId: null,
      labels: [{ id: 'l1', name: 'Bug', color: '#eb5757' }],
    } as Issue
    expect(prefillFrom(issuePrefill(issue), ctx())).toEqual({
      title: 'Copy of Fix login',
      description: 'Details',
      statusId: 'doing',
      priority: 1,
      assigneeId: 'u1',
      projectId: null,
      labelIds: ['l1'],
    })
  })
})
