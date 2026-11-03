import { describe, expect, it } from 'vitest'
import {
  alignBack,
  alignForward,
  currentCycle,
  cycleDayIndex,
  nextCycleWindows,
  setSnapshotPoint,
  type CycleSettings,
} from './schedule'

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
const settings = (overrides: Partial<CycleSettings> = {}): CycleSettings => ({
  durationWeeks: 2,
  startWeekday: 1,
  cooldownWeeks: 0,
  upcomingCount: 2,
  ...overrides,
})
const at = (iso: string) => new Date(iso)
const isMidnightUtc = (date: Date) =>
  date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0

// Tuesday 2026-11-03, mid-afternoon UTC.
const NOW = at('2026-11-03T15:30:00Z')

describe('alignBack / alignForward', () => {
  it('finds the previous and next start weekday at 00:00 UTC', () => {
    expect(alignBack(NOW, 1)).toEqual(at('2026-11-02T00:00:00Z'))
    expect(alignForward(NOW, 1)).toEqual(at('2026-11-09T00:00:00Z'))
    // The same weekday: back is today's midnight, forward is today only at exactly midnight.
    expect(alignBack(NOW, 2)).toEqual(at('2026-11-03T00:00:00Z'))
    expect(alignForward(at('2026-11-03T00:00:00Z'), 2)).toEqual(at('2026-11-03T00:00:00Z'))
    expect(alignForward(NOW, 2)).toEqual(at('2026-11-10T00:00:00Z'))
  })

  it.each([0, 1, 2, 3, 4, 5, 6])('lands on weekday %i', (weekday) => {
    const back = alignBack(NOW, weekday)
    const forward = alignForward(NOW, weekday)
    expect(back.getUTCDay()).toBe(weekday)
    expect(forward.getUTCDay()).toBe(weekday)
    expect(isMidnightUtc(back) && isMidnightUtc(forward)).toBe(true)
    expect(back.getTime()).toBeLessThanOrEqual(NOW.getTime())
    expect(NOW.getTime() - back.getTime()).toBeLessThan(WEEK)
    expect(forward.getTime()).toBeGreaterThan(NOW.getTime())
    expect(forward.getTime() - NOW.getTime()).toBeLessThanOrEqual(WEEK)
  })
})

describe('nextCycleWindows', () => {
  it('starts a new team with a current cycle plus the upcoming count', () => {
    const windows = nextCycleWindows(settings(), null, NOW)
    expect(windows).toEqual([
      { number: 1, startsAt: at('2026-11-02T00:00:00Z'), endsAt: at('2026-11-16T00:00:00Z') },
      { number: 2, startsAt: at('2026-11-16T00:00:00Z'), endsAt: at('2026-11-30T00:00:00Z') },
      { number: 3, startsAt: at('2026-11-30T00:00:00Z'), endsAt: at('2026-12-14T00:00:00Z') },
    ])
    expect(currentCycle(windows, NOW)?.number).toBe(1)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('makes %i-week cycles', (durationWeeks) => {
    const windows = nextCycleWindows(settings({ durationWeeks }), null, NOW)
    expect(windows).toHaveLength(3)
    for (const w of windows)
      expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(durationWeeks * WEEK)
    // Back to back without a cooldown.
    expect(windows[1]!.startsAt).toEqual(windows[0]!.endsAt)
  })

  it.each([0, 1, 2, 3, 4, 5, 6])('starts every cycle on weekday %i', (startWeekday) => {
    const windows = nextCycleWindows(settings({ startWeekday }), null, NOW)
    for (const w of windows) {
      expect(w.startsAt.getUTCDay()).toBe(startWeekday)
      expect(isMidnightUtc(w.startsAt)).toBe(true)
    }
    expect(currentCycle(windows, NOW)).toBe(windows[0])
  })

  it.each([0, 1, 2])('leaves a %i-week cooldown between cycles', (cooldownWeeks) => {
    const windows = nextCycleWindows(settings({ cooldownWeeks }), null, NOW)
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!.startsAt.getTime() - windows[i - 1]!.endsAt.getTime()).toBe(
        cooldownWeeks * WEEK,
      )
    }
  })

  it.each([1, 2, 3, 6])('keeps %i upcoming cycles', (upcomingCount) => {
    const windows = nextCycleWindows(settings({ upcomingCount }), null, NOW)
    expect(windows.filter((w) => w.startsAt > NOW)).toHaveLength(upcomingCount)
  })

  it('continues the chain and only tops up the missing upcoming cycles', () => {
    const last = {
      number: 5,
      startsAt: at('2026-11-16T00:00:00Z'),
      endsAt: at('2026-11-30T00:00:00Z'),
    }
    // Cycles 4 (current) and 5 exist; 5 is the only upcoming one.
    expect(nextCycleWindows(settings(), last, NOW, 1)).toEqual([
      { number: 6, startsAt: at('2026-11-30T00:00:00Z'), endsAt: at('2026-12-14T00:00:00Z') },
    ])
    expect(nextCycleWindows(settings(), last, NOW, 2)).toEqual([])
  })

  it('creates the next cycle once the current one ends', () => {
    const last = {
      number: 1,
      startsAt: at('2026-10-19T00:00:00Z'),
      endsAt: at('2026-11-02T00:00:00Z'),
    }
    const windows = nextCycleWindows(settings({ upcomingCount: 1 }), last, NOW)
    expect(windows.map((w) => w.number)).toEqual([2, 3])
    expect(windows[0]!.startsAt).toEqual(last.endsAt)
    expect(currentCycle(windows, NOW)?.number).toBe(2)
  })

  it('has no current cycle during a cooldown', () => {
    const last = {
      number: 1,
      startsAt: at('2026-10-19T00:00:00Z'),
      endsAt: at('2026-11-02T00:00:00Z'),
    }
    const windows = nextCycleWindows(settings({ cooldownWeeks: 1, upcomingCount: 1 }), last, NOW)
    expect(windows).toEqual([
      { number: 2, startsAt: at('2026-11-09T00:00:00Z'), endsAt: at('2026-11-23T00:00:00Z') },
    ])
    expect(currentCycle(windows, NOW)).toBeNull()
  })

  it('restarts in the current week after a long pause', () => {
    const last = {
      number: 3,
      startsAt: at('2026-01-05T00:00:00Z'),
      endsAt: at('2026-01-19T00:00:00Z'),
    }
    const windows = nextCycleWindows(settings({ upcomingCount: 1 }), last, NOW)
    expect(windows[0]).toEqual({
      number: 4,
      startsAt: at('2026-11-02T00:00:00Z'),
      endsAt: at('2026-11-16T00:00:00Z'),
    })
  })

  it('moves to a new start weekday after the last cycle', () => {
    // The last cycle ended on a Monday; the team now starts cycles on Wednesdays.
    const last = {
      number: 1,
      startsAt: at('2026-10-26T00:00:00Z'),
      endsAt: at('2026-11-09T00:00:00Z'),
    }
    const [next] = nextCycleWindows(settings({ startWeekday: 3, upcomingCount: 1 }), last, NOW)
    expect(next!.startsAt).toEqual(at('2026-11-11T00:00:00Z'))
  })

  it.each([
    ['EU spring forward', '2026-03-25T10:00:00Z'],
    ['EU fall back', '2026-10-21T10:00:00Z'],
    ['US spring forward', '2026-03-04T10:00:00Z'],
    ['US fall back', '2026-10-28T10:00:00Z'],
  ])('keeps whole UTC days across a DST change (%s)', (_name, iso) => {
    for (const durationWeeks of [1, 2, 3]) {
      const windows = nextCycleWindows(settings({ durationWeeks }), null, at(iso))
      for (const w of windows) {
        expect(isMidnightUtc(w.startsAt) && isMidnightUtc(w.endsAt)).toBe(true)
        expect(w.startsAt.getUTCDay()).toBe(1)
        expect(w.endsAt.getTime() - w.startsAt.getTime()).toBe(durationWeeks * WEEK)
      }
    }
  })
})

describe('currentCycle', () => {
  const cycles = [
    {
      number: 1,
      startsAt: at('2026-10-19T00:00:00Z'),
      endsAt: at('2026-11-02T00:00:00Z'),
      completedAt: null,
    },
    {
      number: 2,
      startsAt: at('2026-11-02T00:00:00Z'),
      endsAt: at('2026-11-16T00:00:00Z'),
      completedAt: null,
    },
  ]

  it('uses half-open windows', () => {
    expect(currentCycle(cycles, at('2026-11-02T00:00:00Z'))?.number).toBe(2)
    expect(currentCycle(cycles, at('2026-11-01T23:59:59Z'))?.number).toBe(1)
    expect(currentCycle(cycles, at('2026-11-16T00:00:00Z'))).toBeNull()
  })

  it('skips completed cycles', () => {
    const closed = cycles.map((c) => ({ ...c, completedAt: NOW }))
    expect(currentCycle(closed, NOW)).toBeNull()
  })
})

describe('snapshots', () => {
  const cycle = { startsAt: at('2026-11-02T00:00:00Z'), endsAt: at('2026-11-16T00:00:00Z') }

  it('maps a time to its cycle day, clamped', () => {
    expect(cycleDayIndex(cycle, at('2026-11-02T00:00:00Z'))).toBe(0)
    expect(cycleDayIndex(cycle, NOW)).toBe(1)
    expect(cycleDayIndex(cycle, at('2026-11-16T05:00:00Z'))).toBe(13)
  })

  it('replaces a day and pads skipped days', () => {
    expect(setSnapshotPoint([], 2, 5)).toEqual([null, null, 5])
    expect(setSnapshotPoint([1, 2], 1, 3)).toEqual([1, 3])
  })
})
