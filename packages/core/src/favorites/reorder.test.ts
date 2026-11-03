import { describe, expect, it } from 'vitest'
import { mergeFavoriteOrder } from './reorder'

describe('mergeFavoriteOrder', () => {
  it('puts the requested ids first, in order', () => {
    expect(mergeFavoriteOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b'])
  })

  it('keeps unmentioned favorites after the requested ones, in their current order', () => {
    expect(mergeFavoriteOrder(['a', 'b', 'c', 'd'], ['d', 'b'])).toEqual(['d', 'b', 'a', 'c'])
  })

  it('rejects unknown ids', () => {
    expect(mergeFavoriteOrder(['a', 'b'], ['a', 'x'])).toBeNull()
  })

  it('rejects repeated ids', () => {
    expect(mergeFavoriteOrder(['a', 'b'], ['a', 'a'])).toBeNull()
  })
})
