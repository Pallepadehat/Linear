import type { ListIssuesInput } from '@linear/contract'
import { orpc } from '@/lib/orpc'

const PAGE_SIZE = 50

export type IssueListFilter = Pick<ListIssuesInput, 'teamId' | 'projectId' | 'assignee' | 'creator'>

/** Newest-first issue pages for a workspace, narrowed by team, project, assignee or creator. */
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
