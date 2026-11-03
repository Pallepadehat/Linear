import { describe, expect, it } from 'vitest'
import { decodeListCursor, encodeListCursor, escapeLike, parseIdentifierQuery } from './list-query'

const ID = '0192f5a0-0000-7000-8000-000000000001'

describe('list cursors', () => {
  it('round-trips for the sort it was issued for', () => {
    const cursor = encodeListCursor('createdAt', 'desc', { value: '1762160000123456', id: ID })
    expect(decodeListCursor(cursor, 'createdAt', 'desc')).toEqual({
      value: '1762160000123456',
      id: ID,
    })
    const due = encodeListCursor('dueDate', 'asc', { value: 'infinity', id: ID })
    expect(decodeListCursor(due, 'dueDate', 'asc')).toEqual({ value: 'infinity', id: ID })
    const priority = encodeListCursor('priority', 'asc', { value: '5', id: ID })
    expect(decodeListCursor(priority, 'priority', 'asc')).toEqual({ value: '5', id: ID })
    const estimate = encodeListCursor('estimate', 'desc', { value: '-8', id: ID })
    expect(decodeListCursor(estimate, 'estimate', 'desc')).toEqual({ value: '-8', id: ID })
  })

  it('rejects other sorts, bad values and garbage', () => {
    const cursor = encodeListCursor('createdAt', 'desc', { value: '1', id: ID })
    const bad = { code: 'BAD_REQUEST' }
    expect(() => decodeListCursor(cursor, 'createdAt', 'asc')).toThrow(expect.objectContaining(bad))
    expect(() => decodeListCursor(cursor, 'priority', 'desc')).toThrow(expect.objectContaining(bad))
    const cases = [
      ['not-a-cursor', 'createdAt'],
      [ID, 'createdAt'],
      [encodeListCursor('priority', 'desc', { value: '9', id: ID }), 'priority'],
      [encodeListCursor('estimate', 'desc', { value: '1e3', id: ID }), 'estimate'],
      [encodeListCursor('updatedAt', 'desc', { value: 'now()', id: ID }), 'updatedAt'],
      [encodeListCursor('dueDate', 'desc', { value: 'tomorrow', id: ID }), 'dueDate'],
      [encodeListCursor('updatedAt', 'desc', { value: '1', id: 'x' }), 'updatedAt'],
    ] as const
    for (const [raw, sort] of cases) {
      expect(() => decodeListCursor(raw, sort, 'desc')).toThrow(expect.objectContaining(bad))
    }
  })
})

describe('search helpers', () => {
  it('recognizes identifiers case-insensitively', () => {
    expect(parseIdentifierQuery(' tip-12 ')).toEqual({ teamKey: 'TIP', number: 12 })
    expect(parseIdentifierQuery('TIP 12')).toBeNull()
    expect(parseIdentifierQuery('login')).toBeNull()
    expect(parseIdentifierQuery('tip-1234567890')).toBeNull()
  })

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b')
  })
})
