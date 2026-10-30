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
  it('prefers Todo', () => {
    const statuses = [status('Ready', 'unstarted', 1), status('Todo', 'unstarted', 2)]
    expect(defaultStatus(statuses)?.name).toBe('Todo')
  })

  it('falls back to the first unstarted status by position', () => {
    const statuses = [
      status('Backlog', 'backlog', 0),
      status('Later', 'unstarted', 3),
      status('Ready', 'unstarted', 2),
    ]
    expect(defaultStatus(statuses)?.name).toBe('Ready')
  })
})
