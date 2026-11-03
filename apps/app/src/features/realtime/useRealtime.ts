import type { ContractClient } from '@linear/contract'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/websocket'
import { useQueryClient } from '@tanstack/vue-query'
import { toValue, watch, type MaybeRefOrGetter } from 'vue'
import { apiBase } from '@/lib/api-base'
import { clientId } from '@/lib/client-id'
import { createRealtimeEventHandler } from './realtime-events'

const MAX_BACKOFF_MS = 30_000

/** 1 s, 2 s, 4 s … capped at 30 s, with jitter so reconnecting tabs don't stampede. */
export function backoffDelay(attempt: number, random = Math.random) {
  const base = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** attempt)
  return Math.round(base * (0.5 + random() / 2))
}

/**
 * Keeps one WebSocket per open workspace and applies teammates' changes to the
 * query caches as they happen (docs/domain.md → Realtime events). Reconnects with
 * backoff; events missed while disconnected aren't replayed, so a reconnect
 * refetches the active queries.
 */
export function useRealtime(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()

  watch(
    () => toValue(workspaceSlug),
    (slug, _previous, onCleanup) => {
      if (!slug) return
      const controller = new AbortController()
      onCleanup(() => controller.abort())
      const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: slug })
      void stayConnected(slug, controller.signal, handle, () => queryClient.invalidateQueries())
    },
    { immediate: true },
  )
}

async function stayConnected(
  workspaceSlug: string,
  signal: AbortSignal,
  handle: ReturnType<typeof createRealtimeEventHandler>,
  resync: () => Promise<unknown>,
) {
  let attempt = 0
  let connectedBefore = false
  while (!signal.aborted) {
    let socket: WebSocket | undefined
    try {
      socket = await openSocket(signal)
      const realtime: ContractClient = createORPCClient(new RPCLink({ websocket: socket }))
      const events = await realtime.realtime.subscribe({ workspaceSlug, clientId }, { signal })
      if (connectedBefore) void resync()
      connectedBefore = true
      attempt = 0
      for await (const event of events) handle(event)
    } catch {
      // Closed socket, API restart, network drop: fall through to the retry.
    } finally {
      socket?.close()
    }
    await wait(backoffDelay(attempt++), signal)
  }
}

function socketUrl() {
  const url = new URL('/rpc/ws', apiBase)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

/** Resolves once the socket is open; the session cookie goes along with the upgrade. */
function openSocket(signal: AbortSignal) {
  return new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(socketUrl())
    const fail = () => {
      socket.close()
      reject(new Error('WebSocket closed'))
    }
    socket.addEventListener('open', () => resolve(socket), { once: true })
    socket.addEventListener('error', fail, { once: true })
    socket.addEventListener('close', fail, { once: true })
    signal.addEventListener('abort', fail, { once: true })
  })
}

/** Sleeps `ms`, cut short when the browser comes back online or `signal` aborts. */
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      window.removeEventListener('online', done)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    window.addEventListener('online', done)
    signal.addEventListener('abort', done)
  })
}
