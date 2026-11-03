import { describe, expect, it } from 'vitest'
import {
  groupSelectionState,
  retainSelection,
  selectRange,
  toggleGroupSelection,
  toggleSelection,
} from './selection'

const order = ['a', 'b', 'c', 'd', 'e']
const set = (...ids: string[]) => new Set(ids)

describe('selectRange', () => {
  it('adds everything between the anchor and the target, in either direction', () => {
    expect(selectRange(order, 'b', 'd', set('b'))).toEqual(set('b', 'c', 'd'))
    expect(selectRange(order, 'd', 'a', set())).toEqual(set('a', 'b', 'c', 'd'))
  })

  it('keeps what was already selected outside the range', () => {
    expect(selectRange(order, 'c', 'd', set('a', 'c'))).toEqual(set('a', 'c', 'd'))
  })

  it('selects only the target without an anchor, or when the anchor left the list', () => {
    expect(selectRange(order, null, 'c', set())).toEqual(set('c'))
    expect(selectRange(order, 'gone', 'c', set('a'))).toEqual(set('a', 'c'))
  })

  it('ignores a target that is not listed', () => {
    expect(selectRange(order, 'a', 'zzz', set('a'))).toEqual(set('a'))
  })

  it('follows render order, not id order', () => {
    expect(selectRange(['e', 'a', 'c'], 'e', 'a', set())).toEqual(set('e', 'a'))
  })
})

describe('toggle and groups', () => {
  it('toggles one issue without mutating the current set', () => {
    const current = set('a')
    expect(toggleSelection(current, 'a')).toEqual(set())
    expect(toggleSelection(current, 'b')).toEqual(set('a', 'b'))
    expect(current).toEqual(set('a'))
  })

  it('reports and toggles a group', () => {
    expect(groupSelectionState(set(), ['a', 'b'])).toBe(false)
    expect(groupSelectionState(set('a'), ['a', 'b'])).toBe('mixed')
    expect(groupSelectionState(set('a', 'b', 'x'), ['a', 'b'])).toBe(true)
    expect(toggleGroupSelection(set('a', 'x'), ['a', 'b'])).toEqual(set('a', 'b', 'x'))
    expect(toggleGroupSelection(set('a', 'b', 'x'), ['a', 'b'])).toEqual(set('x'))
  })

  it('drops issues that left the list', () => {
    const current = set('a', 'b')
    expect(retainSelection(current, set('a', 'b', 'c'))).toBe(current)
    expect(retainSelection(current, set('b'))).toEqual(set('b'))
  })
})
