import type { Issue, IssuePage } from '@linear/contract'
import type { InfiniteData, QueryClient } from '@tanstack/vue-query'
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

/** One issue by its `TIP-200` identifier (case-insensitive on the server). */
export const issueByIdentifierOptions = (workspaceSlug: string, identifier: string) =>
  orpc.issues.getByIdentifier.queryOptions({ input: { workspaceSlug, identifier } })

/** Writes a saved issue into its detail cache and every cached list page that holds it. */
export function storeIssue(queryClient: QueryClient, workspaceSlug: string, issue: Issue) {
  queryClient.setQueryData(
    issueByIdentifierOptions(workspaceSlug, issue.identifier).queryKey,
    issue,
  )
  queryClient.setQueriesData<InfiniteData<IssuePage>>({ queryKey: issueListKey() }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === issue.id ? issue : item)),
          })),
        }
      : data,
  )
}

/** Oldest-first comment pages for one issue. */
export const commentListOptions = (workspaceSlug: string, issueId: string) =>
  orpc.comments.list.infiniteOptions({
    input: (cursor: string | null) => ({ workspaceSlug, issueId, cursor, limit: 100 }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
  })

/** Oldest-first activity pages for one issue. */
export const activityListOptions = (workspaceSlug: string, issueId: string) =>
  orpc.activity.list.infiniteOptions({
    input: (cursor: string | null) => ({ workspaceSlug, issueId, cursor, limit: 100 }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
  })
