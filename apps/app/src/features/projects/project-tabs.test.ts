import { describe, expect, it } from 'vitest'
import { parseProjectTab, projectTabQuery } from './project-tabs'

describe('parseProjectTab', () => {
  it('reads a known tab and falls back to Overview', () => {
    expect(parseProjectTab({ tab: 'issues' })).toBe('issues')
    expect(parseProjectTab({ tab: ['activity', 'issues'] })).toBe('activity')
    expect(parseProjectTab({})).toBe('overview')
    expect(parseProjectTab({ tab: 'board' })).toBe('overview')
  })
})

describe('projectTabQuery', () => {
  it('sets the tab and keeps filters; Overview drops the param', () => {
    expect(projectTabQuery({ milestone: 'm1' }, 'issues')).toEqual({
      milestone: 'm1',
      tab: 'issues',
    })
    expect(projectTabQuery({ tab: 'issues', milestone: 'm1' }, 'overview')).toEqual({
      milestone: 'm1',
    })
  })
})
