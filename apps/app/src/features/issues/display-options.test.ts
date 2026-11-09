import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DISPLAY_OPTIONS,
  completedAfter,
  displayListInput,
  displayViewKey,
  effectiveSubGrouping,
  isDefaultDisplayOptions,
  parseDisplayOptions,
} from './display-options'

const NOW = new Date('2026-11-03T12:34:56.789Z')

describe('displayViewKey', () => {
  it('keys options by the page the view is on', () => {
    expect(displayViewKey({ teamId: 't' })).toBe('team:t')
    expect(displayViewKey({ projectId: 'p' })).toBe('project:p')
    expect(displayViewKey({ teamId: 't', cycleId: 'c' })).toBe('cycle:c')
    expect(displayViewKey({ assignee: 'me' })).toBe('my')
    expect(displayViewKey({ creator: 'me' })).toBe('my')
    expect(displayViewKey({})).toBe('all')
    // A saved view keeps its own draft, even on a team.
    expect(displayViewKey({ savedViewId: 'v', teamId: 't' })).toBe('view:v')
  })
})

describe('parseDisplayOptions', () => {
  it('falls back to the defaults for nothing or junk', () => {
    expect(parseDisplayOptions(undefined)).toEqual(DEFAULT_DISPLAY_OPTIONS)
    expect(parseDisplayOptions('board')).toEqual(DEFAULT_DISPLAY_OPTIONS)
  })

  it('keeps valid fields and replaces invalid ones one by one', () => {
    const parsed = parseDisplayOptions({
      layout: 'board',
      grouping: 'swimlanes',
      ordering: 'priority',
      showEmptyGroups: 'yes',
      properties: ['labels', 'id', 'id'],
    })
    expect(parsed).toEqual({
      ...DEFAULT_DISPLAY_OPTIONS,
      layout: 'board',
      ordering: 'priority',
      // Chip order, no duplicates.
      properties: ['id', 'labels'],
    })
    expect(parseDisplayOptions({ properties: ['id', 'nope'] }).properties).toEqual(
      DEFAULT_DISPLAY_OPTIONS.properties,
    )
  })

  it('knows the defaults', () => {
    expect(isDefaultDisplayOptions(parseDisplayOptions({}))).toBe(true)
    expect(isDefaultDisplayOptions({ ...DEFAULT_DISPLAY_OPTIONS, layout: 'board' })).toBe(false)
    expect(DEFAULT_DISPLAY_OPTIONS.properties).not.toContain('updatedAt')
  })
})

describe('effectiveSubGrouping', () => {
  it('needs a grouping and never repeats it', () => {
    const options = { ...DEFAULT_DISPLAY_OPTIONS, subGrouping: 'priority' as const }
    expect(effectiveSubGrouping(options)).toBe('priority')
    expect(effectiveSubGrouping({ ...options, grouping: 'none' })).toBe('none')
    expect(effectiveSubGrouping({ ...options, grouping: 'priority' })).toBe('none')
  })
})

describe('completedAfter', () => {
  it('starts the window a day, week or month back, in whole minutes', () => {
    expect(completedAfter('all', NOW)).toBeUndefined()
    expect(completedAfter('none', NOW)).toBeUndefined()
    expect(completedAfter('day', NOW)?.toISOString()).toBe('2026-11-02T12:34:00.000Z')
    expect(completedAfter('week', NOW)?.toISOString()).toBe('2026-10-27T12:34:00.000Z')
    expect(completedAfter('month', NOW)?.getMonth()).toBe(new Date(NOW).getMonth() - 1)
    // Same minute, same key: the list query stays cached.
    expect(completedAfter('day', new Date(NOW.getTime() + 2_000))).toEqual(
      completedAfter('day', NOW),
    )
  })
})

describe('displayListInput', () => {
  it('sends the ordering and sub-issue option', () => {
    expect(
      displayListInput(
        { ...DEFAULT_DISPLAY_OPTIONS, ordering: 'priority', orderDirection: 'asc' },
        undefined,
        NOW,
      ),
    ).toEqual({ sort: 'priority', direction: 'asc', showSubIssues: true })
  })

  it('maps Completed issues: None to the open categories, within a view tab', () => {
    const none = { ...DEFAULT_DISPLAY_OPTIONS, completedIssues: 'none' as const }
    expect(displayListInput(none, undefined, NOW).statusCategories).toEqual([
      'backlog',
      'unstarted',
      'started',
    ])
    expect(displayListInput(none, ['backlog'], NOW).statusCategories).toEqual(['backlog'])
    expect(displayListInput(DEFAULT_DISPLAY_OPTIONS, ['backlog'], NOW).statusCategories).toEqual([
      'backlog',
    ])
  })

  it('sends completedAfter for a time window', () => {
    const week = { ...DEFAULT_DISPLAY_OPTIONS, completedIssues: 'week' as const }
    expect(displayListInput(week, undefined, NOW)).toMatchObject({
      completedAfter: completedAfter('week', NOW),
    })
    expect(displayListInput(week, undefined, NOW)).not.toHaveProperty('statusCategories')
  })
})
