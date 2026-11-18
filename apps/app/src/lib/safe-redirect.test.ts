import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it.each([
    ['/tip/my-issues', '/tip/my-issues'],
    ['/tip/issue/TIP-1?tab=activity', '/tip/issue/TIP-1?tab=activity'],
    ['//evil.example/phish', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/'],
    [undefined, '/'],
    [['/tip'], '/'],
  ])('%j → %j', (value, expected) => {
    expect(safeRedirect(value)).toBe(expected)
  })
})
