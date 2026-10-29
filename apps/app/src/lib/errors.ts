import { ORPCError } from '@orpc/client'

export function errorCode(error: unknown): string | undefined {
  return error instanceof ORPCError ? error.code : undefined
}

/** A message that is safe to show: the server's for client errors (4xx), generic otherwise. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ORPCError && error.status < 500) return error.message
  return fallback
}
