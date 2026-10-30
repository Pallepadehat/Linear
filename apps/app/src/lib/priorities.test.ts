import { describe, expect, it } from 'vitest'
import { PRIORITIES, priorityLabel } from './priorities'

describe('priorities', () => {
  it('orders priorities as stored, Urgent first after No priority', () => {
    expect(PRIORITIES.map((p) => p.value)).toEqual([0, 1, 2, 3, 4])
  })

  it('labels each priority', () => {
    expect(priorityLabel(0)).toBe('No priority')
    expect(priorityLabel(1)).toBe('Urgent')
    expect(priorityLabel(4)).toBe('Low')
  })
})
