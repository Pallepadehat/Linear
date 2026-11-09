import { ORPCError, os } from '@orpc/server'
import type { InitialContext } from '../context'

export const requireAuth = os.$context<InitialContext>().middleware(async ({ context, next }) => {
  const session = await context.auth.api.getSession({ headers: context.headers })
  if (!session) throw new ORPCError('UNAUTHORIZED')
  return next({ context: { session: session.session, user: session.user } })
})
