export type DomainErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT'

/**
 * Thrown by services for expected failures. The API maps the code onto an
 * oRPC error; the worker treats it as a permanent (non-retryable) failure.
 */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

/** Postgres unique_violation, optionally for a specific constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const cause = error instanceof Error && 'cause' in error ? error.cause : error
  if (typeof cause !== 'object' || cause === null) return false
  const pg = cause as { code?: unknown; constraint_name?: unknown }
  return pg.code === '23505' && (constraint === undefined || pg.constraint_name === constraint)
}
