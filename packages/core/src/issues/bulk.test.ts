import { describe, expect, it } from 'vitest'
import { nextLabelIds } from './bulk'

describe('nextLabelIds', () => {
  it('adds and removes labels, keeping the existing ones', () => {
    expect(nextLabelIds(['a', 'b'], ['c'], ['a'])).toEqual(['b', 'c'])
  })

  it('returns undefined when nothing changes', () => {
    expect(nextLabelIds(['a'], ['a'], ['z'])).toBeUndefined()
    expect(nextLabelIds([], [], [])).toBeUndefined()
  })

  it('lets a removal win over an add of the same label', () => {
    expect(nextLabelIds(['a'], ['b'], ['b'])).toBeUndefined()
  })
})
