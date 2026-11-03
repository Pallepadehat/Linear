/**
 * One open `/rpc/ws` socket, in the context of every call made over it. Heartbeats
 * need it: presence is per connection, and closing the socket clears it.
 */
export type RealtimeConnection = {
  id: string
  /** Workspaces this socket currently subscribes to (via `realtime.subscribe`). */
  workspaces: Map<string, number>
  /** Workspaces this socket has sent heartbeats for (cleared on close). */
  present: Set<string>
  /** Runs `fn` once the socket closes. */
  onClose(fn: () => Promise<void>): void
}

export function createRealtimeConnection() {
  const closers: (() => Promise<void>)[] = []
  const connection: RealtimeConnection = {
    id: crypto.randomUUID(),
    workspaces: new Map(),
    present: new Set(),
    onClose: (fn) => void closers.push(fn),
  }
  const close = () => Promise.allSettled(closers.splice(0).map((fn) => fn()))
  return { connection, close }
}
