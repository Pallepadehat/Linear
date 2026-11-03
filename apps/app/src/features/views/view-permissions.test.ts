import { describe, expect, it } from 'vitest'
import { canEditView, copyName } from './view-permissions'

const owner = { id: 'u1', name: 'Ada', avatarUrl: null }

describe('canEditView', () => {
  it('lets the owner or a workspace owner change a shared view', () => {
    const view = { shared: true, owner }
    expect(canEditView(view, 'u1', 'member')).toBe(true)
    expect(canEditView(view, 'u2', 'owner')).toBe(true)
    expect(canEditView(view, 'u2', 'member')).toBe(false)
  })

  it('lets whoever sees a private view (its owner) change it', () => {
    expect(canEditView({ shared: false, owner }, 'u1', 'member')).toBe(true)
  })
})

describe('copyName', () => {
  it('appends (copy) within the name limit', () => {
    expect(copyName('Bugs')).toBe('Bugs (copy)')
    expect(copyName('x'.repeat(80))).toHaveLength(80)
  })
})
