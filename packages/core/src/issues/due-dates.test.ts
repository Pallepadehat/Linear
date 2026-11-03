import { describe, expect, it } from 'vitest'
import { addDays, classifyDueDate, daysUntil, endOfWeek, isIsoDate } from './due-dates'

describe('due date arithmetic', () => {
  it('validates calendar days', () => {
    expect(isIsoDate('2026-11-03')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-11-3')).toBe(false)
    expect(isIsoDate('2026-11-03T00:00:00Z')).toBe(false)
  })

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-29', 7)).toBe('2026-04-05')
    expect(addDays('2026-11-03', -3)).toBe('2026-10-31')
  })

  it('counts whole days', () => {
    expect(daysUntil('2026-11-03', '2026-11-03')).toBe(0)
    expect(daysUntil('2026-11-06', '2026-11-03')).toBe(3)
    expect(daysUntil('2026-11-01', '2026-11-03')).toBe(-2)
  })

  it('ends the week on Sunday (Monday–Sunday weeks)', () => {
    // 2026-11-02 is a Monday.
    expect(endOfWeek('2026-11-02')).toBe('2026-11-08')
    expect(endOfWeek('2026-11-05')).toBe('2026-11-08')
    expect(endOfWeek('2026-11-07')).toBe('2026-11-08')
    expect(endOfWeek('2026-11-08')).toBe('2026-11-08')
    expect(endOfWeek('2026-12-30')).toBe('2027-01-03')
  })
})

describe('classifyDueDate', () => {
  const today = '2026-11-03'

  it('is null without a due date', () => {
    expect(classifyDueDate(null, today, 'started')).toBeNull()
  })

  it('marks days before today as overdue', () => {
    expect(classifyDueDate('2026-11-02', today, 'unstarted')).toBe('overdue')
    expect(classifyDueDate('2025-01-01', today, 'backlog')).toBe('overdue')
  })

  it('marks today through two days ahead as due soon', () => {
    expect(classifyDueDate('2026-11-03', today, 'started')).toBe('dueSoon')
    expect(classifyDueDate('2026-11-05', today, 'started')).toBe('dueSoon')
    expect(classifyDueDate('2026-11-06', today, 'started')).toBe('normal')
  })

  it('never flags completed or canceled issues', () => {
    expect(classifyDueDate('2026-11-01', today, 'completed')).toBe('normal')
    expect(classifyDueDate('2026-11-03', today, 'canceled')).toBe('normal')
  })
})
