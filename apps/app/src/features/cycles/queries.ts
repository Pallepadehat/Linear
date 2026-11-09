import { orpc } from '@/lib/orpc'

/** A team's cycles (current, upcoming, past) with progress counts. */
export const cycleListOptions = (workspaceSlug: string, teamId: string) =>
  orpc.cycles.list.queryOptions({ input: { workspaceSlug, teamId } })

export const cycleOptions = (workspaceSlug: string, id: string) =>
  orpc.cycles.get.queryOptions({ input: { workspaceSlug, id } })

/** Every cycle query (lists and details), for invalidation after issue changes. */
export const cyclesKey = () => orpc.cycles.key()
