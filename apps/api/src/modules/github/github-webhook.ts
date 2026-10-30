import { createHmac, timingSafeEqual } from 'node:crypto'
import { receiveWebhookDelivery } from '@linear/core'
import { enqueue } from '@linear/queue'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppDeps } from '../../app'

const deliveryHeaders = z.object({
  'x-github-delivery': z.uuid(),
  'x-github-event': z.string().min(1),
})
const payloadSchema = z.record(z.string(), z.unknown())

export async function registerGithubWebhook(app: FastifyInstance, deps: AppDeps) {
  // Encapsulation keeps the raw-body parser away from auth and oRPC routes.
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers()
    scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => {
      done(null, body)
    })
    scope.post('/webhooks/github', async (request, reply) => {
      const signature = request.headers['x-hub-signature-256']
      const secret = deps.env.GITHUB_WEBHOOK_SECRET
      const body = request.body
      if (
        !secret ||
        !Buffer.isBuffer(body) ||
        typeof signature !== 'string' ||
        !/^sha256=[a-fA-F0-9]{64}$/.test(signature)
      ) {
        return reply.code(401).send()
      }
      const expected = createHmac('sha256', secret).update(body).digest()
      if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) {
        return reply.code(401).send()
      }

      const headers = deliveryHeaders.safeParse(request.headers)
      let payload: unknown
      try {
        payload = JSON.parse(body.toString('utf8'))
      } catch {
        return reply.code(400).send()
      }
      const parsed = payloadSchema.safeParse(payload)
      if (!headers.success || !parsed.success) return reply.code(400).send()

      const deliveryId = headers.data['x-github-delivery']
      const event = headers.data['x-github-event']
      const delivery = await receiveWebhookDelivery(deps.db, {
        deliveryId,
        event,
        payload: parsed.data,
      })
      if (!delivery || event !== 'pull_request') return reply.code(200).send()

      await enqueue(
        deps.queues,
        'githubWebhooks',
        'pull_request',
        { deliveryId },
        { jobId: deliveryId },
      )
      return reply.code(202).send()
    })
  })
}
