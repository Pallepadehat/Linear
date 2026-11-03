import { describe, expect, it } from 'vitest'
import { realtimeChannel, realtimeEventSchema, workspaceIdOfChannel } from './realtime'

const id = '01936b2e-0000-7000-8000-000000000001'

describe('realtime events', () => {
  it('round-trips the workspace id through the channel name', () => {
    expect(realtimeChannel(id)).toBe(`workspace:${id}`)
    expect(workspaceIdOfChannel(realtimeChannel(id))).toBe(id)
    expect(workspaceIdOfChannel('bull:media:events')).toBeNull()
  })

  it('accepts ID-only events and rejects extra record data', () => {
    const event = {
      type: 'issue.updated',
      issueId: id,
      actorId: null,
      originId: null,
      fields: ['status'],
    }
    expect(realtimeEventSchema.parse({ ...event, title: 'leak' })).toEqual(event)
    expect(() => realtimeEventSchema.parse({ ...event, fields: ['secret'] })).toThrow()
  })
})
