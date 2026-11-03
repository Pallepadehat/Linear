import { describe, expect, it } from 'vitest'
import { progressPercent, projectStatusMeta } from './project-status'

describe('progressPercent', () => {
  it('is 0 for a project without issues', () => {
    expect(progressPercent({ completed: 0, total: 0 })).toBe(0)
  })

  it('rounds to a whole percentage', () => {
    expect(progressPercent({ completed: 1, total: 3 })).toBe(33)
    expect(progressPercent({ completed: 2, total: 3 })).toBe(67)
    expect(progressPercent({ completed: 4, total: 4 })).toBe(100)
  })

  it('never exceeds 100', () => {
    expect(progressPercent({ completed: 5, total: 4 })).toBe(100)
  })
})

describe('projectStatusMeta', () => {
  it('labels every status', () => {
    expect(projectStatusMeta('in_progress')).toMatchObject({
      label: 'In Progress',
      icon: 'started',
    })
    expect(projectStatusMeta('canceled')).toMatchObject({ label: 'Canceled', icon: 'canceled' })
  })
})
