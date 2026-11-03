import { describe, expect, it } from 'vitest'
import {
  classifyDueDate,
  describeDueDate,
  dueDateShortcuts,
  endOfWeek,
  formatDueDate,
  todayIso,
} from './due-dates'

const today = '2026-11-03' // a Tuesday

describe('due dates', () => {
  it("reads today from the viewer's local clock", () => {
    expect(todayIso(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03')
    expect(todayIso(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })

  it('ends weeks on Sunday', () => {
    expect(endOfWeek('2026-11-02')).toBe('2026-11-08')
    expect(endOfWeek('2026-11-08')).toBe('2026-11-08')
    expect(endOfWeek('2026-12-29')).toBe('2027-01-03')
  })

  it('classifies overdue and due soon, never for finished issues', () => {
    expect(classifyDueDate(null, today, 'started')).toBeNull()
    expect(classifyDueDate('2026-11-02', today, 'started')).toBe('overdue')
    expect(classifyDueDate('2026-11-05', today, 'backlog')).toBe('dueSoon')
    expect(classifyDueDate('2026-11-06', today, 'backlog')).toBe('normal')
    expect(classifyDueDate('2026-11-02', today, 'completed')).toBe('normal')
  })

  it('formats short dates and tooltips', () => {
    expect(formatDueDate('2026-11-07', today)).toBe('Nov 7')
    expect(formatDueDate('2027-01-02', today)).toBe('Jan 2, 2027')
    expect(describeDueDate('2026-11-06', today, 'started')).toBe('Due in 3 days')
    expect(describeDueDate('2026-11-04', today, 'started')).toBe('Due tomorrow')
    expect(describeDueDate('2026-11-03', today, 'started')).toBe('Due today')
    expect(describeDueDate('2026-11-01', today, 'started')).toBe('Overdue by 2 days')
    expect(describeDueDate('2026-11-02', today, 'started')).toBe('Overdue by 1 day')
    expect(describeDueDate('2026-11-01', today, 'completed')).toBe('Was due 2 days ago')
  })

  it('offers today, tomorrow, end of week and one week out', () => {
    expect(dueDateShortcuts(today).map((s) => s.date)).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-08',
      '2026-11-10',
    ])
  })
})
