import type { Favorite } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { findFavorite, moveFavorite } from './favorite-list'

const team: Favorite = { id: 'f1', entityType: 'team', entityId: 't1', name: 'Tip', key: 'TIP' }
const project: Favorite = {
  id: 'f2',
  entityType: 'project',
  entityId: 'p1',
  name: 'Launch',
  iconUrl: null,
}

describe('findFavorite', () => {
  it('matches on entity type and id', () => {
    expect(findFavorite([team, project], { entityType: 'project', entityId: 'p1' })).toBe(project)
    expect(findFavorite([team, project], { entityType: 'issue', entityId: 'p1' })).toBeUndefined()
    expect(findFavorite(undefined, { entityType: 'team', entityId: 't1' })).toBeUndefined()
  })
})

describe('moveFavorite', () => {
  it('moves an item forward and backward', () => {
    expect(moveFavorite(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveFavorite(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('clamps the target and ignores out-of-range sources', () => {
    expect(moveFavorite(['a', 'b'], 0, 9)).toEqual(['b', 'a'])
    const list = ['a', 'b']
    expect(moveFavorite(list, 5, 0)).toBe(list)
  })
})
