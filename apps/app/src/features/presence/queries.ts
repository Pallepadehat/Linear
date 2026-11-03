import { orpc } from '@/lib/orpc'

/**
 * Pushed by `presence.changed`; the interval also picks up teammates whose tab died
 * without closing (pruned server-side once their entry expires).
 */
export const presenceListOptions = (workspaceSlug: string) => ({
  ...orpc.presence.list.queryOptions({ input: { workspaceSlug } }),
  enabled: Boolean(workspaceSlug),
  refetchInterval: 60_000,
})
