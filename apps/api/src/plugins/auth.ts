import type { FastifyInstance } from 'fastify'
import type { Auth } from '../auth/auth'
import { toFetchHeaders } from '../lib/headers'

/** Mounts Better Auth at /api/auth/* by bridging Fastify to its fetch handler. */
export async function registerAuth(app: FastifyInstance, auth: Auth) {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.host}`)
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: toFetchHeaders(request.headers),
          body:
            request.method === 'GET' || request.body === undefined
              ? undefined
              : JSON.stringify(request.body),
        }),
      )

      reply.status(response.status)
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length > 0) reply.header('set-cookie', cookies)
      return reply.send(response.body ? await response.text() : null)
    },
  })
}
