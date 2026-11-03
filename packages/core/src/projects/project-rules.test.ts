import { describe, expect, it } from 'vitest'
import { assertProjectDates, assertProjectPriority } from './project-rules'

describe('assertProjectPriority', () => {
  it.each([0, 1, 2, 3, 4])('accepts %i', (priority) => {
    expect(() => assertProjectPriority(priority)).not.toThrow()
  })

  it.each([-1, 5, 1.5, Number.NaN])('rejects %d as BAD_REQUEST', (priority) => {
    expect(() => assertProjectPriority(priority)).toThrow(
      expect.objectContaining({ code: 'BAD_REQUEST' }),
    )
  })
})

describe('assertProjectDates', () => {
  it('allows either date to be unset', () => {
    expect(() => assertProjectDates(null, null)).not.toThrow()
    expect(() => assertProjectDates('2026-11-03', null)).not.toThrow()
    expect(() => assertProjectDates(null, '2026-11-03')).not.toThrow()
  })

  it('allows a start on or before the target', () => {
    expect(() => assertProjectDates('2026-11-03', '2026-11-03')).not.toThrow()
    expect(() => assertProjectDates('2026-11-03', '2027-01-15')).not.toThrow()
  })

  it('rejects a start after the target', () => {
    expect(() => assertProjectDates('2026-12-01', '2026-11-30')).toThrow(
      expect.objectContaining({ code: 'BAD_REQUEST' }),
    )
  })

  it('rejects values that are not calendar days', () => {
    for (const day of ['2026-1-3', '2026-11-03T10:00:00Z', 'tomorrow', '2026-13-01']) {
      expect(() => assertProjectDates(day, null)).toThrow(
        expect.objectContaining({ code: 'BAD_REQUEST' }),
      )
    }
  })
})
