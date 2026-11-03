// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS } from './issue-filters'
import { issueFacetsOptions, issueListOptions } from './queries'

const inputOf = (queryKey: readonly unknown[]) =>
  (queryKey[1] as { input: Record<string, unknown> }).input

describe('issueFacetsOptions', () => {
  it('asks for the same issues as the list, without paging or sort', () => {
    const filters = { ...EMPTY_FILTERS, due: ['overdue' as const], q: 'login', priorities: [1] }
    const scope = { teamId: '0190a3c0-0000-7000-8000-000000000001' }
    const list = inputOf(issueListOptions('tip', scope, filters).queryKey)
    const facets = inputOf(issueFacetsOptions('tip', scope, filters).queryKey)

    const { sort: _s, direction: _d, cursor: _c, limit: _l, ...listFilters } = list
    expect(facets).toEqual(listFilters)
    // Relative due filters need the viewer's day, or the counts drift from the list.
    expect(facets.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
