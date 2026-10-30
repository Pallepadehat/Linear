import { DomainError } from './errors'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cursors are row ids; reject anything else before it reaches a uuid comparison. */
export function assertCursor(cursor: string | null | undefined) {
  if (cursor && !UUID_PATTERN.test(cursor)) throw new DomainError('BAD_REQUEST', 'Invalid cursor')
}
