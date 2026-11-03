import { describe, expect, it } from 'vitest'
import { relationRoles } from './roles'

describe('relationRoles', () => {
  it('reads directed relations from both sides', () => {
    expect(relationRoles('blocks')).toEqual({ source: 'blocks', target: 'blocked_by' })
    expect(relationRoles('duplicate')).toEqual({ source: 'duplicate_of', target: 'duplicated_by' })
  })

  it('reads related the same from both sides', () => {
    expect(relationRoles('related')).toEqual({ source: 'related', target: 'related' })
  })
})
