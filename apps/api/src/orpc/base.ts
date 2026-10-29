import { contract } from '@linear/contract'
import { DomainError } from '@linear/core'
import { ORPCError, implement } from '@orpc/server'
import { toORPCError } from '../lib/errors'
import type { InitialContext } from './context'
import { requireAuth } from './middleware/require-auth'

export const os = implement(contract)
  .$context<InitialContext>()
  .use(async ({ context, next, path }) => {
    try {
      return await next()
    } catch (error) {
      // Expected failures go back to the client typed; anything else is a bug worth logging.
      if (!(error instanceof DomainError) && !(error instanceof ORPCError)) {
        context.logger.error({ err: error, procedure: path.join('.') }, 'procedure failed')
      }
      throw toORPCError(error)
    }
  })

export const authed = os.use(requireAuth)
