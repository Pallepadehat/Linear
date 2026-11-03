import type { Milestone } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { milestonePercent, moveMilestone } from './milestone-list'

const milestone = (id: string, sortOrder: number): Milestone => ({
  id,
  projectId: 'p',
  name: id,
  description: null,
  targetDate: null,
  sortOrder,
  issueCount: 0,
  doneCount: 0,
  progress: 0,
  isComplete: false,
  createdAt: new Date('2026-01-01'),
})

describe('moveMilestone', () => {
  const list = ['a', 'b', 'c'].map(milestone)
  it('moves a milestone and renumbers the order', () => {
    expect(moveMilestone(list, 'c', 0).map((m) => [m.id, m.sortOrder])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ])
    expect(moveMilestone(list, 'a', 2).map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })
  it('returns the same list for no-op or out-of-range moves', () => {
    expect(moveMilestone(list, 'a', 0)).toBe(list)
    expect(moveMilestone(list, 'a', 3)).toBe(list)
    expect(moveMilestone(list, 'x', 1)).toBe(list)
  })
})

describe('milestonePercent', () => {
  it('rounds to whole percent', () => {
    expect(milestonePercent({ progress: 1 / 3 })).toBe(33)
    expect(milestonePercent({ progress: 0 })).toBe(0)
  })
})
