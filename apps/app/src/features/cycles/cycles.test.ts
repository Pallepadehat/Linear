import type { Cycle } from '@linear/contract'
import { describe, expect, it } from 'vitest'
import {
  assignableCycles,
  burnUpPoints,
  cycleName,
  cycleOptionLabel,
  cyclePercent,
  cycleRange,
  cycleState,
  previewFirstCycle,
} from './cycles'

const NOW = new Date('2026-11-03T15:00:00Z')
const cycle = (
  number: number,
  start: string,
  end: string,
  completedAt: Date | null = null,
): Cycle => ({
  id: `c${number}`,
  teamId: 't',
  number,
  name: null,
  startsAt: new Date(start),
  endsAt: new Date(end),
  completedAt,
  progress: { scope: 4, started: 1, completed: 1 },
})
const past = cycle(1, '2026-10-19T00:00:00Z', '2026-11-02T00:00:00Z', NOW)
const current = cycle(2, '2026-11-02T00:00:00Z', '2026-11-16T00:00:00Z')
const upcoming = cycle(3, '2026-11-16T00:00:00Z', '2026-11-30T00:00:00Z')

describe('cycles', () => {
  it('names and labels cycles with their inclusive UTC days', () => {
    expect(cycleName(current)).toBe('Cycle 2')
    expect(cycleName({ ...current, name: 'Launch' })).toBe('Launch')
    expect(cycleRange(current)).toBe('Nov 2 – Nov 15')
    expect(cycleOptionLabel(upcoming)).toBe('Cycle 3 · Nov 16 – Nov 29')
  })

  it('sorts cycles into current, upcoming and past', () => {
    expect([past, current, upcoming].map((c) => cycleState(c, NOW))).toEqual([
      'past',
      'current',
      'upcoming',
    ])
    expect(assignableCycles([upcoming, past, current], NOW)).toEqual([current, upcoming])
  })

  it('computes progress and burn-up points', () => {
    expect(cyclePercent({ scope: 4, started: 1, completed: 1 })).toBe(25)
    expect(cyclePercent({ scope: 0, started: 0, completed: 0 })).toBe(0)
    expect(burnUpPoints([null, 3, 4], [null, 1])).toEqual([
      { day: 1, scope: 3, completed: 1 },
      { day: 2, scope: 4, completed: 0 },
    ])
  })

  it('previews the first cycle like the server schedules it', () => {
    expect(previewFirstCycle({ cycleDurationWeeks: 2, cycleStartWeekday: 1 }, NOW)).toEqual({
      startsAt: new Date('2026-11-02T00:00:00Z'),
      endsAt: new Date('2026-11-16T00:00:00Z'),
    })
    expect(
      previewFirstCycle({ cycleDurationWeeks: 1, cycleStartWeekday: 3 }, NOW).startsAt,
    ).toEqual(new Date('2026-10-28T00:00:00Z'))
  })
})
