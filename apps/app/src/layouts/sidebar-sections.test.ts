import { describe, expect, it } from 'vitest'
import {
  isSectionExpanded,
  setSectionExpanded,
  SIDEBAR_SECTIONS,
  teamSectionKey,
} from './sidebar-sections'

describe('sidebar sections', () => {
  it('expands sections and collapses teams by default', () => {
    expect(isSectionExpanded({}, SIDEBAR_SECTIONS.workspace)).toBe(true)
    expect(isSectionExpanded({}, SIDEBAR_SECTIONS.teams)).toBe(true)
    expect(isSectionExpanded({}, teamSectionKey('t1'))).toBe(false)
  })

  it('toggles a key without mutating the previous state', () => {
    const before = {}
    const after = setSectionExpanded(before, SIDEBAR_SECTIONS.teams)
    expect(after).toEqual({ teams: false })
    expect(before).toEqual({})
    expect(isSectionExpanded(setSectionExpanded(after, SIDEBAR_SECTIONS.teams), 'teams')).toBe(true)
  })

  it('sets an explicit value', () => {
    const key = teamSectionKey('t1')
    expect(isSectionExpanded(setSectionExpanded({}, key, true), key)).toBe(true)
    expect(isSectionExpanded(setSectionExpanded({ [key]: true }, key, true), key)).toBe(true)
  })
})
