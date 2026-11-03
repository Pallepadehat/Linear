import { describe, expect, it } from 'vitest'
import { viewFiltersSchema } from '@linear/contract'
import { EMPTY_FILTERS, type IssueFilters } from '@/features/issues/issue-filters'
import { fromViewFilters, hasFilterQuery, sameFilters, toViewFilters } from './view-filters'

const a = '0190a8a4-6f5d-7c8e-9a1b-2c3d4e5f6a7b'
const b = '0190a8a4-6f5d-7c8e-9a1b-2c3d4e5f6a7c'

/** Saves and reads back like the server does (strict parse, JSON round trip). */
function roundTrip(filters: IssueFilters) {
  const saved = viewFiltersSchema.parse(toViewFilters(filters))
  const json = JSON.parse(JSON.stringify(saved)) as Record<string, unknown>
  const dates = ['createdAfter', 'createdBefore', 'updatedAfter', 'updatedBefore']
  for (const key of [...dates, 'completedSince', 'completedBefore']) {
    if (typeof json[key] === 'string') json[key] = new Date(json[key] as string)
  }
  return fromViewFilters(viewFiltersSchema.parse(json))
}

describe('view filters', () => {
  it('stores only the filters that are set', () => {
    expect(
      toViewFilters({ ...EMPTY_FILTERS, priorities: [1], q: 'bug', assigneeIds: [null] }),
    ).toEqual({ priorities: [1], q: 'bug', assigneeIds: [null] })
    expect(toViewFilters(EMPTY_FILTERS)).toEqual({})
  })

  it('never stores the clock: due buckets keep no `today`, past windows stay relative', () => {
    const stored = toViewFilters({
      ...EMPTY_FILTERS,
      due: ['overdue'],
      created: { kind: 'past', period: 'week' },
    })
    expect(stored).toEqual({ due: ['overdue'], createdWithin: 'week' })
  })

  it('routes operators to the …Not lists and label mode', () => {
    const stored = toViewFilters({
      ...EMPTY_FILTERS,
      statusIds: [a],
      labelIds: [b],
      creatorIds: ['me'],
      operators: { status: 'not', label: 'all' },
    })
    expect(stored).toEqual({
      statusIdsNot: [a],
      labelIds: [b],
      labelMode: 'all',
      creatorIds: ['me'],
    })
  })

  it('round-trips every filter of the filter menu', () => {
    const filters: IssueFilters = {
      ...EMPTY_FILTERS,
      statusIds: [a],
      priorities: [1, 2],
      assigneeIds: [null],
      projectIds: [b],
      milestoneIds: [a],
      cycleIds: [null],
      labelIds: [a, b],
      creatorIds: ['me'],
      operators: { priority: 'not', project: 'not', creator: 'not', label: 'all' },
      estimates: [3, null],
      due: ['overdue', 'noDueDate'],
      subscriberIds: [b],
      created: { kind: 'past', period: '3months' },
      updated: { kind: 'before', date: '2026-10-01' },
      completed: { kind: 'after', date: '2026-09-15' },
      content: 'crash',
      hasPullRequests: false,
      q: 'login',
      hasLinks: true,
    }
    expect(roundTrip(filters)).toEqual(filters)
  })

  it('ignores the order values were picked in', () => {
    expect(
      sameFilters({ ...EMPTY_FILTERS, labelIds: [a, b] }, { ...EMPTY_FILTERS, labelIds: [b, a] }),
    ).toBe(true)
    expect(sameFilters({ ...EMPTY_FILTERS, labelIds: [a] }, EMPTY_FILTERS)).toBe(false)
    // The operator is part of the filter.
    expect(
      sameFilters(
        { ...EMPTY_FILTERS, labelIds: [a] },
        { ...EMPTY_FILTERS, labelIds: [a], operators: { label: 'not' } },
      ),
    ).toBe(false)
  })

  it('tells whether a route query has filters', () => {
    expect(hasFilterQuery({ view: 'active' })).toBe(false)
    expect(hasFilterQuery({ priority: '1' })).toBe(true)
    expect(hasFilterQuery({ 'status-not': a })).toBe(true)
  })
})
