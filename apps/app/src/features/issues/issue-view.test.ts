import { describe, expect, it } from 'vitest'
import { parseIssueView, viewStatusCategories } from './issue-view'

describe('issue view tabs', () => {
  it('maps each view to its status categories', () => {
    expect(viewStatusCategories('active')).toEqual(['started', 'unstarted'])
    expect(viewStatusCategories('backlog')).toEqual(['backlog'])
    expect(viewStatusCategories('all')).toBeUndefined()
    // Lists without tabs (My issues) pass no view.
    expect(viewStatusCategories(undefined)).toBeUndefined()
  })

  it('reads the view from the URL, falling back to All issues', () => {
    expect(parseIssueView({ view: 'active' })).toBe('active')
    expect(parseIssueView({ view: 'backlog' })).toBe('backlog')
    expect(parseIssueView({ view: 'all' })).toBe('all')
    expect(parseIssueView({})).toBe('all')
    expect(parseIssueView({ view: 'done' })).toBe('all')
    expect(parseIssueView({ view: ['backlog', 'active'] })).toBe('backlog')
  })
})
