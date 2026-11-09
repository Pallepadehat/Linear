import { describe, expect, it } from 'vitest'
import { stepFocus } from './list-focus'

describe('stepFocus', () => {
  const ids = ['a', 'b', 'c']

  it('starts at the top going down and at the bottom going up', () => {
    expect(stepFocus(ids, null, 1)).toBe('a')
    expect(stepFocus(ids, null, -1)).toBe('c')
  })

  it('moves one row and stops at the ends', () => {
    expect(stepFocus(ids, 'a', 1)).toBe('b')
    expect(stepFocus(ids, 'b', -1)).toBe('a')
    expect(stepFocus(ids, 'c', 1)).toBe('c')
    expect(stepFocus(ids, 'a', -1)).toBe('a')
  })

  it('restarts when the focused row is gone, and is empty for an empty list', () => {
    expect(stepFocus(ids, 'gone', 1)).toBe('a')
    expect(stepFocus([], 'a', 1)).toBeNull()
  })
})
