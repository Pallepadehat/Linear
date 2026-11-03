import { describe, expect, it } from 'vitest'
import { facetTotal, hiddenByFiltersText, statusGroupCounts } from './filter-counts'

const status = (id: string, name: string, category: 'backlog' | 'unstarted') => ({
  id,
  name,
  category,
})

describe('statusGroupCounts', () => {
  it('adds up same-named statuses of several teams and skips unknown ids', () => {
    const statuses = [
      status('a-backlog', 'Backlog', 'backlog'),
      status('b-backlog', 'Backlog', 'backlog'),
      status('a-todo', 'Todo', 'unstarted'),
    ]
    const counts = [
      { id: 'a-backlog', count: 1 },
      { id: 'b-backlog', count: 2 },
      { id: 'a-todo', count: 4 },
      { id: 'other', count: 9 },
    ]
    expect(statusGroupCounts(counts, statuses)).toEqual(
      new Map([
        ['backlog:Backlog', 3],
        ['unstarted:Todo', 4],
      ]),
    )
    expect(statusGroupCounts(undefined, statuses)).toEqual(new Map())
  })
})

describe('facetTotal and hiddenByFiltersText', () => {
  it('counts the hidden issues', () => {
    expect(
      facetTotal([
        { id: 'a', count: 2 },
        { id: 'b', count: 3 },
      ]),
    ).toBe(5)
    expect(facetTotal(undefined)).toBe(0)
    expect(hiddenByFiltersText(5, 4)).toBe('1 issue hidden by filters')
    expect(hiddenByFiltersText(5, 2)).toBe('3 issues hidden by filters')
    expect(hiddenByFiltersText(5, 5)).toBeNull()
  })
})
