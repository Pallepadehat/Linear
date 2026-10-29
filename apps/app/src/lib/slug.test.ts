import { describe, expect, it } from 'vitest'
import { suggestSlug, suggestTeamKey } from './slug'

describe('suggestSlug', () => {
  it.each([
    ['Tip', 'tip'],
    ['My  Team!', 'my-team'],
    ['Ærø Café', 'r-cafe'],
    ['--x--', 'x'],
  ])('%s → %s', (name, slug) => {
    expect(suggestSlug(name)).toBe(slug)
  })
})

describe('suggestTeamKey', () => {
  it.each([
    ['Tip Development', 'TIP'],
    ['QA', 'QA'],
    ['42 Engineering', 'ENG'],
    ['X', ''],
  ])('%s → %s', (name, key) => {
    expect(suggestTeamKey(name)).toBe(key)
  })
})
