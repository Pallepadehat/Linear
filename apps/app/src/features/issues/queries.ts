import { orpc } from '@/lib/orpc'

const PAGE_SIZE = 50

/** Newest-first issue pages for a workspace, or one team when `teamId` is set. */
export function issueListOptions(workspaceSlug: string, teamId?: string) {
  return orpc.issues.list.infiniteOptions({
    input: (cursor: string | null) => ({ workspaceSlug, teamId, cursor, limit: PAGE_SIZE }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
  })
}

/** Matches every issue list (all teams, every page), for invalidation. */
export const issueListKey = () => orpc.issues.list.key()

export const createIssueMutationOptions = () => orpc.issues.create.mutationOptions()
