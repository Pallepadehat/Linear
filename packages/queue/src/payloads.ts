import { z } from 'zod'
import type { QueueKey } from './names'

// Payloads carry IDs, never full records; handlers reload state from the DB.
export const jobSchemas = {
  media: {
    'process-image': z.object({ uploadId: z.uuid() }),
  },
  maintenance: {
    'delete-objects': z.object({ uploadId: z.uuid() }),
    'cleanup-pending': z.object({}),
    'cleanup-attachments': z.object({}),
    'cycles-maintain': z.object({}),
  },
  githubWebhooks: {
    pull_request: z.object({ deliveryId: z.uuid() }),
  },
} as const satisfies Record<QueueKey, Record<string, z.ZodType>>

export type JobSchemas = typeof jobSchemas
export type JobName<Q extends QueueKey> = keyof JobSchemas[Q] & string
export type JobPayload<
  Q extends QueueKey,
  N extends JobName<Q>,
> = JobSchemas[Q][N] extends z.ZodType ? z.infer<JobSchemas[Q][N]> : never

export function parseJobPayload<Q extends QueueKey, N extends JobName<Q>>(
  queue: Q,
  name: N,
  data: unknown,
): JobPayload<Q, N> {
  const schema = jobSchemas[queue][name] as z.ZodType
  return schema.parse(data) as JobPayload<Q, N>
}
