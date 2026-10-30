import { describe, expect, it } from 'vitest'
import { nextCompletedAt } from './completed-at'

const now = new Date('2026-10-30T12:00:00Z')
const earlier = new Date('2026-10-01T12:00:00Z')

describe('nextCompletedAt', () => {
  it('sets completedAt when entering a completed status', () => {
    expect(nextCompletedAt('completed', null, now)).toEqual(now)
  })

  it('keeps the original completedAt while staying completed', () => {
    expect(nextCompletedAt('completed', earlier, now)).toEqual(earlier)
  })

  it.each(['backlog', 'unstarted', 'started', 'canceled'] as const)(
    'clears completedAt when moving to %s',
    (category) => {
      expect(nextCompletedAt(category, earlier, now)).toBeNull()
    },
  )
})
