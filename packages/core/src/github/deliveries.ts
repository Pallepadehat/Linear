import type { Db } from '@linear/db'
import { webhookDeliveries } from '@linear/db'

export async function receiveWebhookDelivery(
  db: Db,
  input: { deliveryId: string; event: string; payload: Record<string, unknown> },
) {
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({ ...input, status: input.event === 'pull_request' ? 'received' : 'ignored' })
    .onConflictDoNothing({ target: webhookDeliveries.deliveryId })
    .returning({ id: webhookDeliveries.id })
  return delivery
}
