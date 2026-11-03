import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTERS,
  FILTER_QUERY_KEYS,
  dateBounds,
  describeDateFilter,
  hasActiveFilters,
  nextOperator,
  operatorLabel,
  parseIssueFilters,
  periodStart,
  serializeIssueFilters,
  toListInput,
  toggleValues,
  valuesSummary,
  withOperator,
  type IssueFilters,
} from './issue-filters'

const A = '0192f5a0-0000-7000-8000-000000000001'
const B = '0192f5a0-0000-7000-8000-000000000002'

describe('issue filters in the URL', () => {
  it('round-trips every filter', () => {
    const filters: IssueFilters = {
      statusIds: [A, B],
      priorities: [1, 0],
      assigneeIds: [A, null],
      projectIds: [null],
      cycleIds: [A, null],
      labelIds: [B],
      creatorIds: ['me', B],
      operators: {},
      estimates: [3, null, 'any' as const],
      due: ['overdue' as const, 'noDueDate' as const],
      subscriberIds: ['me', A],
      created: { kind: 'past', period: 'week' },
      updated: { kind: 'after', date: '2026-10-01' },
      completed: { kind: 'before', date: '2026-02-28' },
      content: 'redirect loop',
      hasPullRequests: true,
      q: 'login',
      hasLinks: true,
    }
    const query = serializeIssueFilters(filters)
    expect(query).toEqual({
      status: `${A},${B}`,
      priority: '1,0',
      assignee: `${A},none`,
      project: 'none',
      cycle: `${A},none`,
      label: B,
      creator: `me,${B}`,
      estimate: '3,none,any',
      due: 'overdue,noDueDate',
      subscriber: `me,${A}`,
      created: 'past-week',
      updated: 'after-2026-10-01',
      completed: 'before-2026-02-28',
      content: 'redirect loop',
      pr: 'yes',
      q: 'login',
      links: 'has',
    })
    expect(parseIssueFilters(query as Record<string, string>)).toEqual(filters)
  })

  it('leaves defaults out of the URL', () => {
    expect(serializeIssueFilters(EMPTY_FILTERS)).toEqual({})
    expect(parseIssueFilters({})).toEqual(EMPTY_FILTERS)
  })

  it('drops malformed values instead of failing', () => {
    expect(
      parseIssueFilters({
        status: 'nope,' + A,
        priority: ['9', '2', '2'],
        assignee: 'me',
        subscriber: 'you,me',
        estimate: 'x,1000,5,-1',
        q: '  spaced  ',
      }),
    ).toEqual({
      ...EMPTY_FILTERS,
      statusIds: [A],
      priorities: [2],
      subscriberIds: ['me'],
      estimates: [5],
      q: 'spaced',
    })
  })

  it('knows when a filter is active', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, cycleIds: [null] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, assigneeIds: [null] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, estimates: [null] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, creatorIds: ['me'] })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, hasPullRequests: false })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, hasLinks: false })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, content: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTERS, completed: { kind: 'past', period: 'day' } })).toBe(
      true,
    )
  })

  it('toggles a group of values together', () => {
    expect(toggleValues([A], [A, B])).toEqual([A, B])
    expect(toggleValues([A, B], [A, B])).toEqual([])
    expect(toggleValues<string | null>([A], [null])).toEqual([A, null])
  })

  it('round-trips operators as `-not` / `-all` keys', () => {
    const filters: IssueFilters = {
      ...EMPTY_FILTERS,
      statusIds: [A],
      priorities: [0],
      assigneeIds: [null, A],
      projectIds: [B],
      creatorIds: ['me'],
      labelIds: [A, B],
      operators: { status: 'not', priority: 'not', assignee: 'not', creator: 'not', label: 'all' },
      hasPullRequests: false,
      hasLinks: false,
    }
    const query = serializeIssueFilters(filters)
    expect(query).toEqual({
      'status-not': A,
      'priority-not': '0',
      'assignee-not': `none,${A}`,
      project: B,
      'creator-not': 'me',
      'label-all': `${A},${B}`,
      pr: 'no',
      links: 'none',
    })
    expect(parseIssueFilters(query as Record<string, string>)).toEqual(filters)
    expect(
      parseIssueFilters(serializeIssueFilters({ ...filters, operators: { label: 'not' } }) as never)
        .operators,
    ).toEqual({ label: 'not' })
    // Every key the serializer writes is owned by the filters.
    expect(Object.keys(query).every((key) => FILTER_QUERY_KEYS.includes(key))).toBe(true)
  })

  it('drops an operator whose values are gone, and prefers `is` when both keys are present', () => {
    const query = serializeIssueFilters({ ...EMPTY_FILTERS, operators: { status: 'not' } })
    expect(query).toEqual({})
    expect(parseIssueFilters({ status: A, 'status-not': B })).toMatchObject({
      statusIds: [A],
      operators: {},
    })
    // `-all` is only for labels.
    expect(parseIssueFilters({ 'status-all': A }).statusIds).toEqual([])
  })

  it('drops malformed new filter values', () => {
    expect(
      parseIssueFilters({
        created: 'past-year',
        updated: 'after-2026-02-30',
        completed: 'before-yesterday',
        pr: 'maybe',
        links: 'some',
        creator: 'you,me',
        content: '   ',
      }),
    ).toEqual({ ...EMPTY_FILTERS, creatorIds: ['me'] })
  })
})

describe('filter operators', () => {
  it('cycles is / is not, and labels through any of / all of / not', () => {
    expect(nextOperator(undefined, 'status')).toBe('not')
    expect(nextOperator('not', 'status')).toBe('is')
    expect(nextOperator('is', 'label')).toBe('all')
    expect(nextOperator('all', 'label')).toBe('not')
    expect(nextOperator('not', 'label')).toBe('is')
  })

  it("uses Linear's wording for one and several values", () => {
    expect(operatorLabel('is', 1)).toBe('is')
    expect(operatorLabel(undefined, 3)).toBe('is any of')
    expect(operatorLabel('not', 1)).toBe('is not')
    expect(operatorLabel('not', 2)).toBe('is none of')
    expect(operatorLabel('all', 2)).toBe('include all of')
    expect(valuesSummary(['Bug'], 'labels')).toBe('Bug')
    expect(valuesSummary(['Bug', 'UI', 'API'], 'labels')).toBe('3 labels')
    expect(valuesSummary([], 'labels')).toBe('')
  })

  it('stores only non-default operators', () => {
    const filters = { ...EMPTY_FILTERS, operators: { status: 'not' as const } }
    expect(withOperator(filters, 'label', 'all')).toEqual({
      operators: { status: 'not', label: 'all' },
    })
    expect(withOperator(filters, 'status', 'is')).toEqual({ operators: {} })
  })
})

describe('date filters', () => {
  const now = new Date(2026, 10, 3, 15, 30) // Nov 3, 2026 15:30 local

  it('anchors "past …" windows to now', () => {
    expect(periodStart('day', now)).toEqual(new Date(2026, 10, 2, 15, 30))
    expect(periodStart('week', now)).toEqual(new Date(2026, 9, 27, 15, 30))
    expect(periodStart('month', now)).toEqual(new Date(2026, 9, 3, 15, 30))
    expect(periodStart('3months', now)).toEqual(new Date(2026, 7, 3, 15, 30))
  })

  it('turns before/after a day into local-midnight bounds', () => {
    expect(dateBounds({ kind: 'after', date: '2026-10-01' }, now)).toEqual({
      after: new Date(2026, 9, 1),
    })
    // "Before Oct 1" leaves Oct 1 out.
    expect(dateBounds({ kind: 'before', date: '2026-10-01' }, now)).toEqual({
      before: new Date(2026, 9, 1),
    })
    expect(dateBounds(null, now)).toEqual({})
  })

  it('describes the chip', () => {
    expect(describeDateFilter({ kind: 'past', period: '3months' })).toEqual({
      operator: 'in the',
      value: 'past 3 months',
    })
    expect(describeDateFilter({ kind: 'after', date: '2026-10-01' }, 'en-US')).toEqual({
      operator: 'after',
      value: 'Oct 1, 2026',
    })
  })
})

describe('toListInput', () => {
  const now = new Date(2026, 10, 3, 15, 30)

  it('sends nothing without filters', () => {
    expect(toListInput(EMPTY_FILTERS, now)).toEqual({})
  })

  it('routes values to the plain or `Not` lists by operator', () => {
    const input = toListInput(
      {
        ...EMPTY_FILTERS,
        statusIds: [A],
        priorities: [1],
        assigneeIds: [null],
        projectIds: [B],
        creatorIds: ['me'],
        labelIds: [A, B],
        operators: { status: 'not', assignee: 'not', creator: 'not', label: 'all' },
      },
      now,
    )
    expect(input).toEqual({
      statusIdsNot: [A],
      priorities: [1],
      assigneeIdsNot: [null],
      projectIds: [B],
      creatorIdsNot: ['me'],
      labelIds: [A, B],
      labelMode: 'all',
    })
    expect(
      toListInput({ ...EMPTY_FILTERS, labelIds: [A], operators: { label: 'not' } }, now),
    ).toEqual({ labelIdsNot: [A] })
  })

  it('sends dates, content, links, due with today, and search', () => {
    expect(
      toListInput(
        {
          ...EMPTY_FILTERS,
          created: { kind: 'past', period: 'week' },
          completed: { kind: 'before', date: '2026-10-01' },
          updated: { kind: 'after', date: '2026-09-01' },
          content: ' login ',
          hasPullRequests: false,
          hasLinks: true,
          due: ['overdue'],
          q: 'tip',
        },
        now,
      ),
    ).toEqual({
      createdAfter: new Date(2026, 9, 27, 15, 30),
      updatedAfter: new Date(2026, 8, 1),
      completedBefore: new Date(2026, 9, 1),
      content: 'login',
      hasPullRequests: false,
      hasLinks: true,
      due: ['overdue'],
      today: '2026-11-03',
      q: 'tip',
    })
    // "No due date" needs no today.
    expect(toListInput({ ...EMPTY_FILTERS, due: ['noDueDate'] }, now)).not.toHaveProperty('today')
    // "Completed after" is `completedSince`; `completedAfter` belongs to display options.
    expect(
      toListInput({ ...EMPTY_FILTERS, completed: { kind: 'after', date: '2026-10-01' } }, now),
    ).toEqual({ completedSince: new Date(2026, 9, 1) })
    // "No links" is sent as `false`; no filter leaves the field out.
    expect(toListInput({ ...EMPTY_FILTERS, hasLinks: false }, now)).toMatchObject({
      hasLinks: false,
    })
    expect(toListInput(EMPTY_FILTERS, now)).not.toHaveProperty('hasLinks')
  })
})
