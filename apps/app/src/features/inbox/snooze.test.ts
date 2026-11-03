import { describe, expect, it } from 'vitest'
import { snoozePresets } from './snooze'

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

describe('snoozePresets', () => {
  it('offers in 1 hour, tomorrow 9:00 and next Monday 9:00', () => {
    // Wednesday 4 November 2026, 15:30.
    const now = local(2026, 11, 4, 15, 30)
    expect(snoozePresets(now).map((p) => [p.id, p.until])).toEqual([
      ['hour', local(2026, 11, 4, 16, 30)],
      ['tomorrow', local(2026, 11, 5, 9)],
      ['next-week', local(2026, 11, 9, 9)],
    ])
  })

  it('goes to the following Monday on a Monday and across month ends', () => {
    expect(snoozePresets(local(2026, 11, 9, 8)).at(-1)!.until).toEqual(local(2026, 11, 16, 9))
    expect(snoozePresets(local(2026, 11, 30, 10))[1]!.until).toEqual(local(2026, 12, 1, 9))
    // Sunday → the next day.
    expect(snoozePresets(local(2026, 11, 8, 10)).at(-1)!.until).toEqual(local(2026, 11, 9, 9))
  })
})
