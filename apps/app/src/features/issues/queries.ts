import type { Comment, Issue, IssuePage, ListIssuesInput, ReactionEmoji } from '@linear/contract'
import {
  keepPreviousData,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { toast } from 'vue-sonner'
import { errorMessage } from '@/lib/errors'
import { projectsKey } from '@/features/projects/queries'
import { client, orpc } from '@/lib/orpc'
import { patchCommentInPages, toggleReaction } from './comment-cache'
import {
  applyIssuePatch,
  patchIssue,
  patchIssueInPages,
  toUpdateIssueInput,
  type IssuePatch,
} from './issue-cache'
import { EMPTY_FILTERS, type IssueFilters } from './issue-filters'

const PAGE_SIZE = 50

export type IssueListFilter = Pick<
  ListIssuesInput,
  'teamId' | 'projectId' | 'assignee' | 'creator' | 'statusCategories'
>

/**
 * Issue pages for a workspace, narrowed by the page's scope (team, project,
 * assignee or creator) and view tab, then by the user's filters and sort.
 */
export function issueListOptions(
  workspaceSlug: string,
  filter: IssueListFilter = {},
  filters: IssueFilters = EMPTY_FILTERS,
) {
  const { q, ...rest } = filters
  return orpc.issues.list.infiniteOptions({
    input: (cursor: string | null) => ({
      workspaceSlug,
      ...filter,
      ...rest,
      q: q || undefined,
      cursor,
      limit: PAGE_SIZE,
    }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
    // Keep showing the current rows while a new filter or sort loads.
    placeholderData: keepPreviousData,
  })
}

/** Matches every issue list (all teams, every page), for invalidation. */
export const issueListKey = () => orpc.issues.list.key()

export const createIssueMutationOptions = () => orpc.issues.create.mutationOptions()

export type UpdateIssueVariables = { issue: Issue; patch: IssuePatch }

const issueInfiniteListKey = () => orpc.issues.list.key({ type: 'infinite' })
/** Single-issue caches: by id and by `TIP-200` identifier. */
export const issueDetailKeys = () => [orpc.issues.get.key(), orpc.issues.getByIdentifier.key()]

/** Writes `update` into every cache holding the issue: each list page and the detail entries. */
export function writeIssueToCaches(
  queryClient: QueryClient,
  id: string,
  update: (issue: Issue) => Issue,
) {
  queryClient.setQueriesData<InfiniteData<IssuePage>>(
    { queryKey: issueInfiniteListKey() },
    (data) => patchIssueInPages(data, id, update),
  )
  for (const queryKey of issueDetailKeys())
    queryClient.setQueriesData<Issue>({ queryKey }, (data) => patchIssue(data, id, update))
}

/**
 * Issue edits (title, description and every property) applied optimistically to
 * every cached copy of the issue — each list page and the detail entries — rolled
 * back with a toast if the server rejects them.
 */
export function useUpdateIssue(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const listKey = issueInfiniteListKey()
  const detailKeys = issueDetailKeys()
  const mutationKey = orpc.issues.update.mutationKey()
  const patchCaches = (id: string, update: (issue: Issue) => Issue) =>
    writeIssueToCaches(queryClient, id, update)

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
      for (const [queryKey, data] of context?.previous ?? [])
        queryClient.setQueryData(queryKey, data)
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
        // Project progress counts issues by status and project.
        queryClient.invalidateQueries({ queryKey: projectsKey() }),
      ])
    },
  })
}

/** One issue by its `TIP-200` identifier (case-insensitive on the server). */
export const issueByIdentifierOptions = (workspaceSlug: string, identifier: string) =>
  orpc.issues.getByIdentifier.queryOptions({ input: { workspaceSlug, identifier } })

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

export type ToggleReactionVariables = { comment: Comment; emoji: ReactionEmoji; on: boolean }

/**
 * Adds or removes my reaction, shown at once and rolled back with a toast if the
 * server rejects it.
 */
export function useToggleReaction(
  workspaceSlug: MaybeRefOrGetter<string>,
  issueId: MaybeRefOrGetter<string>,
) {
  const queryClient = useQueryClient()
  const queryKey = () => commentListOptions(toValue(workspaceSlug), toValue(issueId)).queryKey
  const mutationKey = orpc.comments.react.mutationKey()

  return useMutation({
    mutationKey,
    mutationFn: ({ comment, emoji, on }: ToggleReactionVariables) => {
      const input = { workspaceSlug: toValue(workspaceSlug), commentId: comment.id, emoji }
      return on ? client.comments.react(input) : client.comments.unreact(input)
    },
    onMutate: async ({ comment, emoji, on }) => {
      await queryClient.cancelQueries({ queryKey: queryKey() })
      const previous = queryClient.getQueryData(queryKey())
      queryClient.setQueryData(queryKey(), (data) =>
        patchCommentInPages(data, comment.id, (c) => ({
          ...c,
          reactions: toggleReaction(c.reactions, emoji, on),
        })),
      )
      return { previous }
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(queryKey(), context?.previous)
      toast.error("Couldn't update the reaction", { description: errorMessage(error) })
    },
    onSettled: async () => {
      // Quick successive toggles would flicker if the first settle refetched.
      if (queryClient.isMutating({ mutationKey }) > 1) return
      await queryClient.invalidateQueries({ queryKey: queryKey() })
    },
  })
}

/** Edit, delete and resolve: not optimistic, refetch the thread when they land. */
export function useCommentActions(
  workspaceSlug: MaybeRefOrGetter<string>,
  issueId: MaybeRefOrGetter<string>,
) {
  const queryClient = useQueryClient()
  const refetch = () =>
    queryClient.invalidateQueries({
      queryKey: commentListOptions(toValue(workspaceSlug), toValue(issueId)).queryKey,
    })
  const onError = (title: string) => (error: Error) =>
    toast.error(title, { description: errorMessage(error) })

  return {
    update: useMutation(
      orpc.comments.update.mutationOptions({
        onSuccess: refetch,
        onError: onError("Couldn't save the comment"),
      }),
    ),
    remove: useMutation(
      orpc.comments.delete.mutationOptions({
        onSuccess: refetch,
        onError: onError("Couldn't delete the comment"),
      }),
    ),
    resolve: useMutation(
      orpc.comments.resolveThread.mutationOptions({
        onSuccess: refetch,
        onError: onError("Couldn't resolve the thread"),
      }),
    ),
    unresolve: useMutation(
      orpc.comments.unresolveThread.mutationOptions({
        onSuccess: refetch,
        onError: onError("Couldn't reopen the thread"),
      }),
    ),
  }
}
