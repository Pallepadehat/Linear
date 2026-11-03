import { describe, expect, it } from 'vitest'
import {
  buildProgressChart,
  dayFromNumber,
  dayNumber,
  doneLabel,
  nearestPoint,
  projectCompletion,
} from './progress-chart'

const point = (date: string, scope: number, started: number, completed: number) => ({
  date,
  scope,
  started,
  completed,
})

describe('days', () => {
  it('round-trips calendar days', () => {
    expect(dayFromNumber(dayNumber('2026-11-03'))).toBe('2026-11-03')
    expect(dayNumber('2026-11-04') - dayNumber('2026-11-03')).toBe(1)
  })
})

describe('projectCompletion', () => {
  const series = [point('2026-11-01', 10, 0, 0), point('2026-11-03', 10, 2, 2)]

  it('carries the pace so far to the target date', () => {
    expect(projectCompletion(series, '2026-11-06')).toEqual({ date: '2026-11-06', completed: 5 })
  })

  it('never projects past the scope', () => {
    expect(projectCompletion(series, '2026-12-31')).toEqual({ date: '2026-12-31', completed: 10 })
  })

  it('needs a future target and two days of history', () => {
    expect(projectCompletion(series, null)).toBeNull()
    expect(projectCompletion(series, '2026-11-03')).toBeNull()
    expect(projectCompletion([series[1]!], '2026-11-06')).toBeNull()
  })
})

describe('buildProgressChart', () => {
  it('spans the first point to the target and stacks completed under started', () => {
    const chart = buildProgressChart(
      [point('2026-11-01', 4, 0, 0), point('2026-11-03', 4, 1, 2)],
      '2026-11-09',
      80,
      40,
    )!
    expect(chart.start).toBe('2026-11-01')
    expect(chart.end).toBe('2026-11-09')
    expect(chart.xs).toEqual([0, 20])
    expect(chart.todayX).toBe(20)
    expect(chart.scopeLine).toBe('0,0 20,0')
    expect(chart.completedArea).toBe('0,40 0,40 20,20 20,40')
    expect(chart.startedArea).toBe('0,40 0,40 20,10 20,40')
    expect(chart.projection).toEqual({ x1: 20, y1: 20, x2: 80, y2: 0 })
  })

  it('widens a single day to a week, ending today', () => {
    const chart = buildProgressChart([point('2026-11-03', 0, 0, 0)], null, 70, 40)!
    expect(chart.start).toBe('2026-10-27')
    expect(chart.end).toBe('2026-11-03')
    expect(chart.todayX).toBe(70)
    expect(chart.projection).toBeNull()
  })

  it('has nothing to draw without points', () => {
    expect(buildProgressChart([], null, 10, 10)).toBeNull()
  })
})

describe('nearestPoint', () => {
  it('picks the closest x', () => {
    expect(nearestPoint([0, 10, 30], 18)).toBe(1)
    expect(nearestPoint([0, 10, 30], 25)).toBe(2)
    expect(nearestPoint([0], 99)).toBe(0)
  })
})

describe('doneLabel', () => {
  it('reads as a rounded percentage of the total', () => {
    expect(doneLabel({ done: 3, total: 3 })).toBe('100% of 3')
    expect(doneLabel({ done: 1, total: 3 })).toBe('33% of 3')
    expect(doneLabel({ done: 0, total: 0 })).toBe('0% of 0')
  })
})
