import type { GitHubAppClient } from '@linear/core'
import type { Db } from '@linear/db'
import type { Queues } from '@linear/queue'
import type { Storage } from '@linear/storage'
import type { FastifyBaseLogger } from 'fastify'
import type { Auth } from '../auth/auth'
import type { PresenceStore } from '../modules/presence/presence.store'
import type { RealtimeConnection } from '../modules/realtime/connection'
import type { RealtimeHub } from '../modules/realtime/realtime.hub'

/** Built per request by the oRPC plugin. */
export type InitialContext = {
  db: Db
  auth: Auth
  queues: Queues
  storage: Storage
  /** Null when the GitHub App isn't configured. */
  github: GitHubAppClient | null
  /** Signs the GitHub install `state`. */
  installStateSecret: string
  /** Publishes domain events to Redis and streams them to subscribers. */
  realtime: RealtimeHub
  /** Who is online and which issue they view (Redis only). */
  presence: PresenceStore
  /** The socket a call arrived on; absent for HTTP calls. */
  connection?: RealtimeConnection
  logger: FastifyBaseLogger
  headers: Headers
}

export type Session = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>
