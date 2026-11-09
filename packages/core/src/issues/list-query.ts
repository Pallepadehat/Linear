import { DomainError } from '../errors'

export const ISSUE_SORTS = ['createdAt', 'updatedAt', 'priority', 'estimate', 'dueDate'] as const
export type IssueSort = (typeof ISSUE_SORTS)[number]
export type SortDirection = 'asc' | 'desc'

/**
 * Keyset position: the last row's sort value plus its id as the tie-breaker.
 * Timestamps are carried as epoch microseconds computed in Postgres, so the
 * value is exact (a JS Date would truncate to milliseconds and skip or repeat rows).
 */
export type ListCursor = { value: string; id: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function encodeListCursor(sort: IssueSort, direction: SortDirection, cursor: ListCursor) {
  return Buffer.from(JSON.stringify([`${sort}:${direction}`, cursor.value, cursor.id])).toString(
    'base64url',
  )
}

/** Rejects malformed cursors and cursors issued for a different sort. */
export function decodeListCursor(
  raw: string,
  sort: IssueSort,
  direction: SortDirection,
): ListCursor {
  const invalid = new DomainError('BAD_REQUEST', 'Invalid cursor')
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    throw invalid
  }
  if (!Array.isArray(parsed) || parsed.length !== 3) throw invalid
  const [key, value, id] = parsed as unknown[]
  if (key !== `${sort}:${direction}` || typeof value !== 'string' || typeof id !== 'string') {
    throw invalid
  }
  if (!UUID_PATTERN.test(id)) throw invalid
  const valid =
    sort === 'priority'
      ? /^[1-5]$/.test(value)
      : sort === 'estimate'
        ? /^-?\d{1,3}$/.test(value)
        : sort === 'dueDate'
          ? // No due date sorts as ±infinity so it stays last in both directions.
            /^(-?infinity|\d{4}-\d{2}-\d{2})$/.test(value)
          : /^-?\d{1,20}$/.test(value)
  if (!valid) throw invalid
  return { value, id }
}

const IDENTIFIER_QUERY = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})$/

/** `tip-12` → `{ teamKey: 'TIP', number: 12 }`; anything else isn't an identifier. */
export function parseIdentifierQuery(q: string) {
  const match = IDENTIFIER_QUERY.exec(q.trim())
  if (!match) return null
  return { teamKey: match[1]!.toUpperCase(), number: Number(match[2]) }
}

/** Escapes LIKE wildcards so user input matches literally. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
