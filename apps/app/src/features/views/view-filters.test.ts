import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS } from '@/features/issues/issue-filters'
import { fromViewFilters, hasFilterQuery, sameFilters, toViewFilters } from './view-filters'

const a = '0190a8a4-6f5d-7c8e-9a1b-2c3d4e5f6a7b'
const b = '0190a8a4-6f5d-7c8e-9a1b-2c3d4e5f6a7c'

describe('view filters', () => {
  it('stores only the filters that are set', () => {
    expect(
      toViewFilters({ ...EMPTY_FILTERS, priorities: [1], q: ' bug ', assigneeIds: [null] }),
    ).toEqual({ priorities: [1], q: 'bug', assigneeIds: [null] })
    expect(toViewFilters(EMPTY_FILTERS)).toEqual({})
  })

  it('round-trips through the stored shape', () => {
    const filters = { ...EMPTY_FILTERS, labelIds: [a], hasLinks: true, due: ['overdue' as const] }
    expect(fromViewFilters(toViewFilters(filters) as never)).toEqual(filters)
  })

  it('ignores the order values were picked in', () => {
    expect(
      sameFilters({ ...EMPTY_FILTERS, labelIds: [a, b] }, { ...EMPTY_FILTERS, labelIds: [b, a] }),
    ).toBe(true)
    expect(sameFilters({ ...EMPTY_FILTERS, labelIds: [a] }, EMPTY_FILTERS)).toBe(false)
  })

  it('tells whether a route query has filters', () => {
    expect(hasFilterQuery({ view: 'active' })).toBe(false)
    expect(hasFilterQuery({ priority: '1' })).toBe(true)
  })
})
