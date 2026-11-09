import { describe, expect, it } from 'vitest'
import { orderAssignees, type AssigneeOption } from './assignee-options'

const user = (id: string, name: string): AssigneeOption => ({
  id,
  name,
  email: `${id}@tip.dev`,
  avatarUrl: null,
})

describe('orderAssignees', () => {
  it('puts the current user first and sorts the rest by name', () => {
    const { me, others } = orderAssignees(
      [user('c', 'carol'), user('me', 'Zed'), user('a', 'Alice'), user('b', 'bob')],
      'me',
    )
    expect(me?.id).toBe('me')
    expect(others.map((o) => [o.user.id, o.shortcut])).toEqual([
      ['a', '2'],
      ['b', '3'],
      ['c', '4'],
    ])
  })

  it('gives digit shortcuts 2–9 to the first eight team members only', () => {
    const users = Array.from({ length: 10 }, (_, i) => user(`u${i}`, `User ${i}`))
    const { me, others } = orderAssignees(users, 'u0')
    expect(me?.id).toBe('u0')
    expect(others.map((o) => o.shortcut)).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      undefined,
    ])
  })

  it('has no "me" row when the current user is not in the list', () => {
    const { me, others } = orderAssignees([user('a', 'Alice')], 'someone-else')
    expect(me).toBeUndefined()
    expect(others[0]?.shortcut).toBe('2')
  })
})
