import { describe, expect, it } from 'vitest'
import { timeAgo } from './relative-time'

const now = new Date('2026-11-03T12:00:00Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000)

describe('timeAgo', () => {
  it.each([
    [ago(10), 'just now'],
    [ago(5 * 60), '5 minutes ago'],
    [ago(3 * 3600), '3 hours ago'],
    [ago(24 * 3600), 'yesterday'],
    [ago(15 * 24 * 3600), '2 weeks ago'],
    [ago(400 * 24 * 3600), 'last year'],
  ])('%s → %s', (date, expected) => {
    expect(timeAgo(date, now)).toBe(expected)
  })
})
