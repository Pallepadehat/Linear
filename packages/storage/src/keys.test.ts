import { describe, expect, it } from 'vitest'
import { objectKey, variantKey } from './keys'

describe('object keys', () => {
  it('scopes avatars under the user', () => {
    expect(objectKey({ type: 'user', userId: 'u1' }, 'avatar', 'up1', 'original', 'png')).toBe(
      'users/u1/avatar/up1/original.png',
    )
  })

  it('scopes workspace files under the workspace', () => {
    expect(
      objectKey(
        { type: 'workspace', workspaceId: 'w1' },
        'workspace_icon',
        'up1',
        'original',
        'svg',
      ),
    ).toBe('workspaces/w1/workspace_icon/up1/original.svg')
  })

  it('derives variant keys next to the original', () => {
    expect(variantKey('users/u1/avatar/up1/original.png', '256', 'webp')).toBe(
      'users/u1/avatar/up1/256.webp',
    )
  })
})
