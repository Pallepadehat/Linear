import type { FastifyInstance } from 'fastify'
import { RPCHandler } from '@orpc/server/fastify'
import type { InitialContext } from '../orpc/context'
import { router } from '../orpc/router'
import { toFetchHeaders } from '../lib/headers'

type Deps = Omit<InitialContext, 'headers' | 'logger'>

/** Mounts the oRPC router at /rpc/*. */
export async function registerORPC(app: FastifyInstance, deps: Deps) {
  const handler = new RPCHandler(router)

  // Encapsulated so the raw-body parser below only applies to /rpc routes.
  await app.register(async (scope) => {
    // Let oRPC parse request bodies itself (it supports more than JSON).
    scope.addContentTypeParser('*', (_request, _payload, done) => done(null, undefined))

    scope.all('/rpc/*', async (request, reply) => {
      const { matched } = await handler.handle(request, reply, {
        prefix: '/rpc',
        context: { ...deps, headers: toFetchHeaders(request.headers), logger: request.log },
      })
      if (!matched) await reply.status(404).send({ message: 'Not found' })
    })
  })
}
