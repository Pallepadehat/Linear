import { DomainError } from '@linear/core'
import { ORPCError } from '@orpc/server'

/** Maps expected domain failures onto typed oRPC errors; anything else stays a 500. */
export function toORPCError(error: unknown): unknown {
  if (error instanceof DomainError) {
    return new ORPCError(error.code, { message: error.message })
  }
  return error
}
