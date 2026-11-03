import websocket from '@fastify/websocket'
import type { FastifyInstance } from 'fastify'
import { RPCHandler } from '@orpc/server/fastify'
import { RPCHandler as WsRPCHandler } from '@orpc/server/ws'
import type { InitialContext } from '../orpc/context'
import { router } from '../orpc/router'
import { toFetchHeaders } from '../lib/headers'

type Deps = Omit<InitialContext, 'headers' | 'logger'>

// Proxies (nginx: 60 s) close idle connections; a ping keeps a quiet socket open.
const PING_INTERVAL_MS = 25_000

/**
 * Mounts the oRPC router at /rpc/* over HTTP, and at /rpc/ws over a WebSocket for
 * long-lived streams (`realtime.subscribe`). Both run the same procedures and middleware.
 */
export async function registerORPC(app: FastifyInstance, deps: Deps, appUrl: string) {
  const handler = new RPCHandler(router)
  const wsHandler = new WsRPCHandler(router)

  await app.register(websocket, { options: { maxPayload: 64 * 1024 } })

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

    scope.get(
      '/rpc/ws',
      {
        websocket: true,
        // Rejected before the upgrade: other sites (cross-site WebSocket hijacking)
        // and requests without a session. Procedures still run requireAuth per call.
        preValidation: async (request, reply) => {
          const origin = request.headers.origin
          if (origin !== undefined && origin !== appUrl) {
            return reply.status(403).send({ message: 'Forbidden' })
          }
          const session = await deps.auth.api.getSession({
            headers: toFetchHeaders(request.headers),
          })
          if (!session) return reply.status(401).send({ message: 'Unauthorized' })
        },
      },
      (socket, request) => {
        const headers = toFetchHeaders(request.headers)
        void wsHandler.upgrade(socket, { context: { ...deps, headers, logger: request.log } })
        const ping = setInterval(() => socket.ping(), PING_INTERVAL_MS)
        socket.on('close', () => clearInterval(ping))
      },
    )
  })
}
