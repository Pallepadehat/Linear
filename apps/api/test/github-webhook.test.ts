import { createHmac, randomUUID } from 'node:crypto'
import { webhookDeliveries } from '@linear/db'
import { describe, expect, it } from 'vitest'
import { setupTestApp } from './harness'

const { app, db, queues } = await setupTestApp()
const body = JSON.stringify({ action: 'opened', pull_request: { number: 1 } }, null, 2)
const signature = (payload: string) =>
  `sha256=${createHmac('sha256', 'test-webhook-secret').update(payload).digest('hex')}`

function send(
  deliveryId: string = randomUUID(),
  event = 'pull_request',
  payload = body,
  sig = signature(payload),
) {
  return app.inject({
    method: 'POST',
    url: '/webhooks/github',
    headers: {
      'content-type': 'application/json',
      'x-github-delivery': deliveryId,
      'x-github-event': event,
      ...(sig ? { 'x-hub-signature-256': sig } : {}),
    },
    payload,
  })
}

async function expectEmpty() {
  expect(await db.select().from(webhookDeliveries)).toEqual([])
  expect(await queues.githubWebhooks.getJobCounts('waiting')).toMatchObject({ waiting: 0 })
}

describe('POST /webhooks/github', () => {
  it.each(['', 'sha256=bad', `sha256=${'0'.repeat(64)}`])(
    'rejects missing or invalid signatures (%s)',
    async (sig) => {
      expect((await send(randomUUID(), 'pull_request', body, sig)).statusCode).toBe(401)
      await expectEmpty()
    },
  )

  it('checks signatures before parsing JSON', async () => {
    expect((await send(randomUUID(), 'pull_request', '{', 'invalid')).statusCode).toBe(401)
    await expectEmpty()
  })

  it('persists the exact signed payload and enqueues an ID-only job', async () => {
    const deliveryId = randomUUID()
    expect((await send(deliveryId)).statusCode).toBe(202)
    expect(await db.select().from(webhookDeliveries)).toMatchObject([
      { deliveryId, event: 'pull_request', status: 'received', payload: JSON.parse(body) },
    ])
    const job = await queues.githubWebhooks.getJob(deliveryId)
    expect(job?.name).toBe('pull_request')
    expect(job?.data).toEqual({ deliveryId })
  })

  it('deduplicates concurrent deliveries', async () => {
    const deliveryId = randomUUID()
    const results = await Promise.all([send(deliveryId), send(deliveryId)])
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 202])
    expect((await send(deliveryId)).statusCode).toBe(200)
    expect(await db.select().from(webhookDeliveries)).toHaveLength(1)
    expect(await queues.githubWebhooks.getJobCounts('waiting')).toMatchObject({ waiting: 1 })
  })

  it('stores other events as ignored without enqueueing', async () => {
    expect((await send(randomUUID(), 'ping')).statusCode).toBe(200)
    expect(await db.select().from(webhookDeliveries)).toMatchObject([
      { event: 'ping', status: 'ignored' },
    ])
    expect(await queues.githubWebhooks.getJobCounts('waiting')).toMatchObject({ waiting: 0 })
  })

  it('rejects signed malformed JSON and missing delivery headers', async () => {
    expect((await send(randomUUID(), 'pull_request', '{')).statusCode).toBe(400)
    expect((await send('invalid')).statusCode).toBe(400)
    await expectEmpty()
  })
})
