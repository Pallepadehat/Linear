import type { WorkflowStatus } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { defaultStatus } from './default-status'

const status = (name: string, category: WorkflowStatus['category'], position: number) => ({
  id: name,
  name,
  category,
  position,
})

describe('defaultStatus', () => {
  it('prefers Backlog by name', () => {
    const statuses = [
      status('Triage', 'backlog', 0),
      status('Backlog', 'backlog', 1),
      status('Todo', 'unstarted', 2),
    ]
    expect(defaultStatus(statuses)?.name).toBe('Backlog')
  })

  it('falls back to the first backlog status when Backlog was renamed', () => {
    const statuses = [
      status('Todo', 'unstarted', 0),
      status('Icebox', 'backlog', 3),
      status('Later', 'backlog', 2),
    ]
    expect(defaultStatus(statuses)?.name).toBe('Later')
  })

  it('falls back to the first unstarted status without any backlog status', () => {
    const statuses = [
      status('Done', 'completed', 0),
      status('Ready', 'unstarted', 2),
      status('Todo', 'unstarted', 1),
    ]
    expect(defaultStatus(statuses)?.name).toBe('Todo')
  })
})
