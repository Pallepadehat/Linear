import { describe, expect, it } from 'vitest'
import { TEAM_KEY_PATTERN, WORKSPACE_SLUG_PATTERN, normalizeTeamKey } from './identifiers'

describe('workspace slug', () => {
  it.each(['tip', 'my-team', 'a1', 'ab', 'x'.repeat(40)])('accepts %s', (slug) => {
    expect(WORKSPACE_SLUG_PATTERN.test(slug)).toBe(true)
  })

  it.each(['', 'a', '-tip', 'tip-', 'Tip', 'ti_p', 'x'.repeat(41)])('rejects %s', (slug) => {
    expect(WORKSPACE_SLUG_PATTERN.test(slug)).toBe(false)
  })
})

describe('team key', () => {
  it('normalizes to uppercase', () => {
    expect(normalizeTeamKey(' tip ')).toBe('TIP')
  })

  it.each(['TIP', 'AB', 'A1', 'ABCDEFGHIJ'])('accepts %s', (key) => {
    expect(TEAM_KEY_PATTERN.test(key)).toBe(true)
  })

  it.each(['T', '1TIP', 'TIP-1', 'ABCDEFGHIJK', 'tip'])('rejects %s', (key) => {
    expect(TEAM_KEY_PATTERN.test(key)).toBe(false)
  })
})
