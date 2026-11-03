import type { PresenceEntry } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import { presenceLabel, viewersOf } from './presence'

const issueId = crypto.randomUUID()
const entry = (overrides: Partial<PresenceEntry>): PresenceEntry => ({
  userId: crypto.randomUUID(),
  state: 'active',
  viewingIssueId: issueId,
  lastSeenAt: new Date(),
  ...overrides,
})

describe('viewersOf', () => {
  it('lists others on the issue, active first, excluding you and offline members', () => {
    const me = entry({})
    const away = entry({ state: 'away' })
    const active = entry({})
    const elsewhere = entry({ viewingIssueId: crypto.randomUUID() })
    const offline = entry({ state: 'offline', viewingIssueId: null })
    expect(viewersOf([me, away, active, elsewhere, offline], issueId, me.userId)).toEqual([
      active,
      away,
    ])
  })
})

describe('presenceLabel', () => {
  const now = new Date('2026-11-03T12:00:00Z')
  it('reads Online, Away, last seen, or Offline', () => {
    expect(presenceLabel(entry({}), now)).toBe('Online')
    expect(presenceLabel(entry({ state: 'away' }), now)).toBe('Away')
    expect(
      presenceLabel(entry({ state: 'offline', lastSeenAt: new Date('2026-11-03T11:55:00Z') }), now),
    ).toBe('Last seen 5 minutes ago')
    expect(presenceLabel(undefined, now)).toBe('Offline')
  })
})
