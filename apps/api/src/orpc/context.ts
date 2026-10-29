import type { Db } from '@linear/db'
import type { Queues } from '@linear/queue'
import type { Storage } from '@linear/storage'
import type { FastifyBaseLogger } from 'fastify'
import type { Auth } from '../auth/auth'

/** Built per request by the oRPC plugin. */
export type InitialContext = {
  db: Db
  auth: Auth
  queues: Queues
  storage: Storage
  logger: FastifyBaseLogger
  headers: Headers
}

export type Session = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>
