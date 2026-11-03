import { orpc } from '@/lib/orpc'

const PAGE_SIZE = 50

export type IssueListFilter = { teamId?: string; projectId?: string }

/** Newest-first issue pages for a workspace, narrowed to a team and/or project. */
export function issueListOptions(workspaceSlug: string, filter: IssueListFilter = {}) {
  return orpc.issues.list.infiniteOptions({
    input: (cursor: string | null) => ({ workspaceSlug, ...filter, cursor, limit: PAGE_SIZE }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
  })
}

/** Matches every issue list (all teams, every page), for invalidation. */
export const issueListKey = () => orpc.issues.list.key()

export const createIssueMutationOptions = () => orpc.issues.create.mutationOptions()
