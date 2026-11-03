import { describe, expect, it } from 'vitest'
import {
  createViewInputSchema,
  parseStoredViewDisplay,
  parseStoredViewFilters,
  viewFiltersSchema,
} from './views'

const id = '0190a8a4-6f5d-7c8e-9a1b-2c3d4e5f6a7b'

describe('viewFiltersSchema', () => {
  it('accepts the list filters', () => {
    const filters = { statusIds: [id], priorities: [1, 2], assigneeIds: [null], q: 'bug' }
    // `labelMode` defaults to "any of".
    expect(viewFiltersSchema.parse(filters)).toEqual({ ...filters, labelMode: 'any' })
  })

  it('accepts the filter menu fields and relative date windows', () => {
    const filters = {
      statusIdsNot: [id],
      labelIds: [id],
      labelMode: 'all',
      creatorIds: ['me'],
      createdWithin: 'week',
      updatedBefore: new Date('2026-10-01T00:00:00.000Z'),
      content: 'crash',
      hasPullRequests: false,
    } as const
    expect(viewFiltersSchema.parse(filters)).toEqual(filters)
  })

  it.each([
    ['an unknown date window', { createdWithin: 'year' }],
    ['a malformed id', { statusIds: ['nope'] }],
    ['an out-of-range priority', { priorities: [9] }],
    ['a page scope field', { teamId: id }],
    ['an unknown field', { colour: 'red' }],
    ['a non-object', 'status=todo'],
  ])('rejects %s', (_, filters) => {
    expect(viewFiltersSchema.safeParse(filters).success).toBe(false)
  })

  it('rejects invalid filter JSON in create input', () => {
    const input = {
      workspaceSlug: 'tip',
      name: 'Bugs',
      filters: { labelIds: [42] },
      display: {},
    }
    expect(createViewInputSchema.safeParse(input).success).toBe(false)
  })
})

describe('parseStoredViewFilters', () => {
  it('drops stale or invalid fields and keeps the rest', () => {
    const filters = parseStoredViewFilters({
      statusIds: [id],
      priorities: ['high'],
      removedField: true,
    })
    expect(filters.statusIds).toEqual([id])
    expect(filters).not.toHaveProperty('priorities')
    expect(filters).not.toHaveProperty('removedField')
  })

  it('revives stored date strings', () => {
    const filters = parseStoredViewFilters({ createdAfter: '2026-10-01T00:00:00.000Z' })
    expect(filters.createdAfter).toEqual(new Date('2026-10-01T00:00:00.000Z'))
  })

  it('reads a non-object as no filters', () => {
    // Only defaults (if any) remain.
    const empty = viewFiltersSchema.parse({})
    expect(parseStoredViewFilters(null)).toEqual(empty)
    expect(parseStoredViewFilters([1])).toEqual(empty)
  })
})

describe('parseStoredViewDisplay', () => {
  it('keeps the fields that still parse', () => {
    expect(
      parseStoredViewDisplay({ layout: 'board', grouping: 'mood', properties: ['id'] }),
    ).toEqual({ layout: 'board', properties: ['id'] })
  })
})
