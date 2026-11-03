import type { Issue, IssuePage, ListIssuesInput, User } from '@linear/contract'
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
import { todayIso } from '@/lib/due-dates'
import { client, orpc } from '@/lib/orpc'
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
  const { q, due, ...rest } = filters
  // Relative due filters are evaluated against the viewer's local day (domain.md).
  const relative = due.some((bucket) => bucket !== 'noDueDate')
  return orpc.issues.list.infiniteOptions({
    input: (cursor: string | null) => ({
      workspaceSlug,
      ...filter,
      ...rest,
      ...(due.length && { due }),
      ...(relative && { today: todayIso() }),
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

/** Members subscribed to one issue (a small, bounded list). */
export const issueSubscribersOptions = (workspaceSlug: string, issueId: string) =>
  orpc.issues.subscribers.queryOptions({ input: { workspaceSlug, issueId } })

export type SubscriptionVariables = {
  issue: Issue
  /** The member to (un)subscribe; the signed-in user when it's them. */
  user: User
  subscribe: boolean
  /** Whether `user` is the signed-in user, whose `isSubscribed` flips with it. */
  isMe: boolean
}

/**
 * Subscribes or unsubscribes a member, optimistically updating the subscriber list
 * (and the bell, for yourself); rolled back with a toast if the server rejects it.
 */
export function useIssueSubscription(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const listKey = issueInfiniteListKey()
  const detailKeys = issueDetailKeys()
  const subscribersKey = (issueId: string) =>
    issueSubscribersOptions(toValue(workspaceSlug), issueId).queryKey

  return useMutation({
    mutationKey: orpc.issues.subscribe.mutationKey(),
    mutationFn: ({ issue, user, subscribe, isMe }: SubscriptionVariables) => {
      const input = {
        workspaceSlug: toValue(workspaceSlug),
        issueId: issue.id,
        ...(isMe ? {} : { userId: user.id }),
      }
      return subscribe ? client.issues.subscribe(input) : client.issues.unsubscribe(input)
    },
    onMutate: async ({ issue, user, subscribe, isMe }) => {
      const subscribers = subscribersKey(issue.id)
      const keys = [subscribers, ...(isMe ? [listKey, ...detailKeys] : [])]
      await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })))
      const previous = keys.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }))
      queryClient.setQueryData<User[]>(subscribers, (current) => {
        if (!current) return current
        const others = current.filter((u) => u.id !== user.id)
        return subscribe ? [...others, user] : others
      })
      if (isMe)
        writeIssueToCaches(queryClient, issue.id, (current) => ({
          ...current,
          isSubscribed: subscribe,
        }))
      return { previous }
    },
    onError: (error, { issue, subscribe }, context) => {
      for (const [queryKey, data] of context?.previous ?? [])
        queryClient.setQueryData(queryKey, data)
      toast.error(
        `Couldn't ${subscribe ? 'subscribe to' : 'unsubscribe from'} ${issue.identifier}`,
        { description: errorMessage(error) },
      )
    },
    onSettled: async (_data, _error, { issue, isMe }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: subscribersKey(issue.id) }),
        ...(isMe ? detailKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })) : []),
      ])
    },
  })
}
