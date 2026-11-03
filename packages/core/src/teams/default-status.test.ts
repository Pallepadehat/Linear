import { describe, expect, it } from 'vitest'
import { pickDefaultStatus } from './default-status'

const status = (id: string, name: string, category: string, position: number) => ({
  id,
  name,
  category,
  position,
})

const defaults = [
  status('todo', 'Todo', 'unstarted', 1),
  status('backlog', 'Backlog', 'backlog', 0),
  status('progress', 'In Progress', 'started', 2),
  status('done', 'Done', 'completed', 3),
]

describe('pickDefaultStatus', () => {
  it('uses the configured team default', () => {
    expect(pickDefaultStatus(defaults, 'progress')?.id).toBe('progress')
  })

  it('falls back to Backlog when no default is configured', () => {
    expect(pickDefaultStatus(defaults, null)?.id).toBe('backlog')
  })

  it('falls back when the configured default is not one of the statuses', () => {
    expect(pickDefaultStatus(defaults, 'gone')?.id).toBe('backlog')
  })

  it('prefers the first backlog status when Backlog was renamed', () => {
    const statuses = [
      status('todo', 'Todo', 'unstarted', 0),
      status('icebox', 'Icebox', 'backlog', 2),
      status('later', 'Later', 'backlog', 1),
    ]
    expect(pickDefaultStatus(statuses, null)?.id).toBe('later')
  })

  it('falls back to the first unstarted status without a backlog', () => {
    const statuses = [
      status('ready', 'Ready', 'unstarted', 1),
      status('todo', 'Todo', 'unstarted', 0),
      status('done', 'Done', 'completed', 2),
    ]
    expect(pickDefaultStatus(statuses, null)?.id).toBe('todo')
  })

  it('returns undefined when nothing qualifies', () => {
    expect(pickDefaultStatus([status('done', 'Done', 'completed', 0)], null)).toBeUndefined()
  })
})
