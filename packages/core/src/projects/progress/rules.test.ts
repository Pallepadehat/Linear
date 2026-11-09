import { describe, expect, it } from 'vitest'
import { countProgress, progressBreakdown, progressSeries } from './rules'

describe('countProgress', () => {
  it('counts every issue in scope, started and completed by status category', () => {
    expect(
      countProgress(['backlog', 'unstarted', 'started', 'started', 'completed', 'canceled']),
    ).toEqual({ scope: 6, started: 2, completed: 1 })
  })

  it('keeps canceled issues in scope only', () => {
    expect(countProgress(['canceled', 'canceled'])).toEqual({ scope: 2, started: 0, completed: 0 })
  })

  it('is all zeros without issues', () => {
    expect(countProgress([])).toEqual({ scope: 0, started: 0, completed: 0 })
  })
})

describe('progressBreakdown', () => {
  it('counts done and total per group, most issues first and the null group last on a tie', () => {
    expect(
      progressBreakdown([
        { group: { key: 'u1', name: 'Ada' }, category: 'completed' },
        { group: { key: null, name: 'No assignee' }, category: 'started' },
        { group: { key: 'u2', name: 'Bo' }, category: 'completed' },
        { group: { key: 'u2', name: 'Bo' }, category: 'canceled' },
        { group: { key: 'u1', name: 'Ada' }, category: 'backlog' },
        { group: { key: null, name: 'No assignee' }, category: 'completed' },
        { group: { key: 'u3', name: 'Cy' }, category: 'started' },
      ]),
    ).toEqual([
      { key: 'u1', name: 'Ada', done: 1, total: 2 },
      { key: 'u2', name: 'Bo', done: 1, total: 2 },
      { key: null, name: 'No assignee', done: 1, total: 2 },
      { key: 'u3', name: 'Cy', done: 0, total: 1 },
    ])
  })

  it('keeps extra fields such as a label color', () => {
    expect(
      progressBreakdown([
        { group: { key: 'l1', name: 'Bug', color: '#ff0000' }, category: 'completed' },
      ]),
    ).toEqual([{ key: 'l1', name: 'Bug', color: '#ff0000', done: 1, total: 1 }])
  })
})

describe('progressSeries', () => {
  const point = (date: string, completed = 0) => ({ date, scope: 5, started: 1, completed })

  it('orders snapshots by date and ends with the live point for today', () => {
    expect(
      progressSeries([point('2026-11-02'), point('2026-11-01')], point('2026-11-03', 2)),
    ).toEqual([point('2026-11-01'), point('2026-11-02'), point('2026-11-03', 2)])
  })

  it("replaces today's stored snapshot with the live counts", () => {
    expect(progressSeries([point('2026-11-03', 1)], point('2026-11-03', 4))).toEqual([
      point('2026-11-03', 4),
    ])
  })
})
