import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  parseIssueFilters,
  serializeIssueFilters,
  toggleValues,
} from './issue-filters'

const A = '0192f5a0-0000-7000-8000-000000000001'
const B = '0192f5a0-0000-7000-8000-000000000002'

describe('issue filters in the URL', () => {
  it('round-trips every filter and sort', () => {
    const filters = {
      statusIds: [A, B],
      priorities: [1, 0],
      assigneeIds: [A, null],
      projectIds: [null],
      labelIds: [B],
      due: ['overdue' as const, 'noDueDate' as const],
      subscriberIds: ['me', A],
      q: 'login',
      sort: 'priority' as const,
      direction: 'asc' as const,
    }
    const query = serializeIssueFilters(filters)
    expect(query).toEqual({
      status: `${A},${B}`,
      priority: '1,0',
      assignee: `${A},none`,
      project: 'none',
      label: B,
      due: 'overdue,noDueDate',
      subscriber: `me,${A}`,
      q: 'login',
      sort: 'priority',
      dir: 'asc',
    })
    expect(parseIssueFilters(query as Record<string, string>)).toEqual(filters)
  })

  it('leaves defaults out of the URL', () => {
    expect(serializeIssueFilters(EMPTY_FILTERS)).toEqual({})
    expect(parseIssueFilters({})).toEqual(EMPTY_FILTERS)
  })

  it('drops malformed values instead of failing', () => {
    expect(
      parseIssueFilters({
        status: 'nope,' + A,
        priority: ['9', '2', '2'],
        assignee: 'me',
        subscriber: 'you,me',
        sort: 'title',
        dir: 'sideways',
        q: '  spaced  ',
      }),
    ).toEqual({
      ...EMPTY_FILTERS,
      statusIds: [A],
      priorities: [2],
      subscriberIds: ['me'],
      q: 'spaced',
    })
  })

  it('knows when a filter is active', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, sort: 'priority' })).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, assigneeIds: [null] })).toBe(true)
  })

  it('toggles a group of values together', () => {
    expect(toggleValues([A], [A, B])).toEqual([A, B])
    expect(toggleValues([A, B], [A, B])).toEqual([])
    expect(toggleValues<string | null>([A], [null])).toEqual([A, null])
  })
})
