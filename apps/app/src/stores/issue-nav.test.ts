import type { Issue } from '@linear/contract'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useIssueNavStore, type IssueNavSource } from './issue-nav'

const source = (identifiers: string[]): IssueNavSource => ({
  queryKey: ['issues', 'list'],
  identifiers,
  // Reverse order stands in for the list's grouping, to prove `refresh` uses it.
  order: (issues) => issues.map((issue) => issue.identifier).reverse(),
  route: '/tip/team/TIP',
})

describe('issueNav store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('reports the position of the opened issue', () => {
    const nav = useIssueNavStore()
    nav.open(source(['TIP-3', 'TIP-1', 'TIP-2']), 'TIP-1')
    nav.enter('TIP-1')
    expect(nav.position).toEqual({ index: 2, total: 3 })
  })

  it('matches identifiers case-insensitively', () => {
    const nav = useIssueNavStore()
    nav.open(source(['TIP-1', 'TIP-2']), 'TIP-2')
    nav.enter('tip-2')
    expect(nav.position).toEqual({ index: 2, total: 2 })
  })

  it('steps to next and previous and stops at the edges', () => {
    const nav = useIssueNavStore()
    nav.open(source(['TIP-1', 'TIP-2', 'TIP-3']), 'TIP-1')
    expect(nav.neighbor(-1)).toBeNull()
    expect(nav.step(-1)).toBeNull()
    expect(nav.position?.index).toBe(1)

    expect(nav.step(1)).toBe('TIP-2')
    nav.enter('TIP-2')
    expect(nav.step(1)).toBe('TIP-3')
    nav.enter('TIP-3')
    expect(nav.position).toEqual({ index: 3, total: 3 })
    expect(nav.step(1)).toBeNull()
    expect(nav.position?.index).toBe(3)

    expect(nav.step(-1)).toBe('TIP-2')
  })

  it('clears the context when an issue is opened directly', () => {
    const nav = useIssueNavStore()
    nav.open(source(['TIP-1', 'TIP-2']), 'TIP-1')
    nav.enter('TIP-1')
    // e.g. a pasted URL or search result, even for an issue that is in the list
    nav.enter('TIP-2')
    expect(nav.source).toBeNull()
    expect(nav.position).toBeNull()
    expect(nav.neighbor(1)).toBeNull()
  })

  it('has no position without a context', () => {
    const nav = useIssueNavStore()
    nav.enter('TIP-1')
    expect(nav.position).toBeNull()
    expect(nav.step(1)).toBeNull()
  })

  it('refreshes the identifiers in the list order', () => {
    const nav = useIssueNavStore()
    nav.open(source(['TIP-1', 'TIP-2']), 'TIP-1')
    const issues = ['TIP-1', 'TIP-2', 'TIP-3'].map((identifier) => ({ identifier }) as Issue)
    nav.refresh(issues)
    expect(nav.source?.identifiers).toEqual(['TIP-3', 'TIP-2', 'TIP-1'])
    expect(nav.position).toEqual({ index: 3, total: 3 })
  })

  it('hides the position once the issue leaves the list', () => {
    const nav = useIssueNavStore()
    nav.open(source(['TIP-1', 'TIP-2']), 'TIP-1')
    nav.refresh([{ identifier: 'TIP-2' } as Issue])
    expect(nav.position).toBeNull()
  })
})
