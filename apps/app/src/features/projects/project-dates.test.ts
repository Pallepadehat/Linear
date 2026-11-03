import { describe, expect, it } from 'vitest'
import { datePresets, formatDay, parseDay } from './project-dates'

// Tuesday, Nov 3 2026 (local time).
const today = new Date(2026, 10, 3)

describe('project dates', () => {
  it('formats a day, adding the year outside the current one', () => {
    expect(formatDay('2026-11-03', today)).toBe('Nov 3')
    expect(formatDay('2027-01-15', today)).toBe('Jan 15, 2027')
  })

  it('offers presets relative to today', () => {
    expect(Object.fromEntries(datePresets(today).map((p) => [p.label, p.day]))).toEqual({
      Today: '2026-11-03',
      Tomorrow: '2026-11-04',
      'End of this week': '2026-11-08',
      'End of this month': '2026-11-30',
      'End of this quarter': '2026-12-31',
      'End of next quarter': '2027-03-31',
    })
  })

  it('parses typed dates and rejects anything that is not a calendar day', () => {
    expect(parseDay('2026-12-01')).toBe('2026-12-01')
    expect(parseDay(' 2026-2-3 ')).toBe('2026-02-03')
    expect(parseDay('Dec 1 2026')).toBe('2026-12-01')
    for (const text of ['', 'end', '2026-02-30', '2026-13-01', 'not 12 a date']) {
      expect(parseDay(text)).toBeNull()
    }
  })
})
