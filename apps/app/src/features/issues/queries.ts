import type { Issue, IssuePage } from '@linear/contract'
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import {
  applyIssuePatch,
  patchIssue,
  patchIssueInPages,
  toUpdateIssueInput,
  type IssuePatch,
} from './issue-cache'

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

export type UpdateIssueVariables = { issue: Issue; patch: IssuePatch }

/**
 * Property changes (status, priority, assignee, labels) applied optimistically to
 * every cached copy of the issue — each list page and the detail entries — rolled
 * back with a toast if the server rejects them.
 */
export function useUpdateIssue(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const listKey = orpc.issues.list.key({ type: 'infinite' })
  const detailKeys = [orpc.issues.get.key(), orpc.issues.getByIdentifier.key()]
  const mutationKey = orpc.issues.update.mutationKey()

  // Writes `update` into every cache holding the issue.
  function patchCaches(id: string, update: (issue: Issue) => Issue) {
    queryClient.setQueriesData<InfiniteData<IssuePage>>({ queryKey: listKey }, (data) =>
      patchIssueInPages(data, id, update),
    )
    for (const queryKey of detailKeys)
      queryClient.setQueriesData<Issue>({ queryKey }, (data) => patchIssue(data, id, update))
  }

  return useMutation({
    mutationKey,
    mutationFn: ({ issue, patch }: UpdateIssueVariables) =>
      client.issues.update(toUpdateIssueInput(toValue(workspaceSlug), issue.id, patch)),
    onMutate: async ({ issue, patch }) => {
      // A refetch landing after the patch would overwrite it with stale data.
      await Promise.all(
        [listKey, ...detailKeys].map((queryKey) => queryClient.cancelQueries({ queryKey })),
      )
      const previous = [
        ...queryClient.getQueriesData({ queryKey: listKey }),
        ...detailKeys.flatMap((queryKey) => queryClient.getQueriesData({ queryKey })),
      ]
      patchCaches(issue.id, (current) => applyIssuePatch(current, patch))
      return { previous }
    },
    onError: (error, { issue }, context) => {
      for (const [queryKey, data] of context?.previous ?? []) queryClient.setQueryData(queryKey, data)
      toast.error(`Couldn't update ${issue.identifier}`, { description: errorMessage(error) })
    },
    onSuccess: (updated) => {
      patchCaches(updated.id, () => updated)
    },
    onSettled: async () => {
      // With several changes in flight, refetching after the first would briefly
      // show the server state without the later ones; wait for the last.
      if (queryClient.isMutating({ mutationKey }) > 1) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey }),
        ...detailKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        queryClient.invalidateQueries({ queryKey: orpc.activity.list.key() }),
      ])
    },
  })
}
