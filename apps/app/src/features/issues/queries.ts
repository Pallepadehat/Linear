import type {
  Comment,
  Issue,
  IssueDetail,
  IssueFiltersInput,
  IssuePage,
  IssueRelationType,
  ListIssuesInput,
  ReactionEmoji,
  User,
} from '@linear/contract'
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
import { cyclesKey } from '@/features/cycles/queries'
import { projectsKey } from '@/features/projects/queries'
import { client, orpc } from '@/lib/orpc'
import { patchCommentInPages, toggleReaction } from './comment-cache'
import {
  applyIssuePatch,
  patchIssue,
  patchIssueInPages,
  removeIssueFromPages,
  removeRelation,
  toUpdateIssueInput,
  type IssuePatch,
} from './issue-cache'
import { EMPTY_FILTERS, toListInput, type IssueFilters } from './issue-filters'

const PAGE_SIZE = 50

/**
 * "Past week" filters are anchored to now, rounded to the minute so the list, board
 * and Details panel built in the same moment share one query key.
 */
function minuteNow() {
  const now = new Date()
  now.setSeconds(0, 0)
  return now
}

export type IssueListFilter = Pick<
  ListIssuesInput,
  'teamId' | 'projectId' | 'cycleId' | 'assignee' | 'creator' | 'statusCategories'
>

/**
 * The shared list filters (`issueFiltersSchema`) for the page's scope and view tab plus
 * the user's filters, so the list and the Details panel always ask for the same issues.
 */
function issueFiltersInput(
  workspaceSlug: string,
  filter: IssueListFilter,
  filters: IssueFilters,
): IssueFiltersInput {
  return { workspaceSlug, ...filter, ...toListInput(filters, minuteNow()) }
}

/**
 * Issue pages for a workspace, narrowed by the page's scope (team, project,
 * assignee or creator) and view tab, then by the user's filters and sort.
 */
export function issueListOptions(
  workspaceSlug: string,
  filter: IssueListFilter = {},
  filters: IssueFilters = EMPTY_FILTERS,
) {
  return orpc.issues.list.infiniteOptions({
    input: (cursor: string | null) => ({
      ...issueFiltersInput(workspaceSlug, filter, filters),
      sort: filters.sort,
      direction: filters.direction,
      cursor,
      limit: PAGE_SIZE,
    }),
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
    // Keep showing the current rows while a new filter or sort loads.
    placeholderData: keepPreviousData,
  })
}

/**
 * The Details panel's counts for the same scope, view and filters as the list
 * (sort doesn't change counts, so it isn't part of the key).
 */
export function issueFacetsOptions(
  workspaceSlug: string,
  filter: IssueListFilter = {},
  filters: IssueFilters = EMPTY_FILTERS,
) {
  return orpc.issues.facets.queryOptions({
    input: issueFiltersInput(workspaceSlug, filter, filters),
    placeholderData: keepPreviousData,
  })
}

/** Every Details panel count; invalidated wherever issue lists are. */
export const issueFacetsKey = () => orpc.issues.facets.key()

/** Matches every issue list (all teams, every page), for invalidation. */
export const issueListKey = () => orpc.issues.list.key()

export const createIssueMutationOptions = () => orpc.issues.create.mutationOptions()

export type UpdateIssueVariables = { issue: Issue; patch: IssuePatch }

const issueInfiniteListKey = () => orpc.issues.list.key({ type: 'infinite' })
/** Single-issue caches: by id and by `TIP-200` identifier. */
export const issueDetailKeys = () => [orpc.issues.get.key(), orpc.issues.getByIdentifier.key()]

/**
 * Writes `update` into every cache holding the issue: each list page and the detail
 * entries. Detail entries keep their relations when `update` returns a plain issue.
 */
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
    queryClient.setQueriesData<IssueDetail>({ queryKey }, (data) => patchIssue(data, id, update))
}

/** Refetches everything a relation change shows up in: details, row counts, activity. */
function invalidateRelationViews(queryClient: QueryClient) {
  return Promise.all([
    ...issueDetailKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    queryClient.invalidateQueries({ queryKey: issueListKey() }),
    queryClient.invalidateQueries({ queryKey: orpc.activity.list.key() }),
    queryClient.invalidateQueries({ queryKey: projectsKey() }),
  ])
}

export type CreateRelationVariables = {
  issueId: string
  relatedIssueId: string
  type: IssueRelationType
}

/** Relates two issues; the views refetch once the server has it (a duplicate also changes status). */
export function useCreateRelation(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: CreateRelationVariables) =>
      client.issueRelations.create({ workspaceSlug: toValue(workspaceSlug), ...variables }),
    onError: (error) => {
      toast.error("Couldn't add the relation", { description: errorMessage(error) })
    },
    onSettled: () => invalidateRelationViews(queryClient),
  })
}

/** Removes a relation optimistically from the detail views, rolled back with a toast. */
export function useDeleteRelation(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const detailKeys = issueDetailKeys()
  return useMutation({
    mutationFn: (relationId: string) =>
      client.issueRelations.delete({ workspaceSlug: toValue(workspaceSlug), id: relationId }),
    onMutate: async (relationId) => {
      await Promise.all(detailKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })))
      const previous = detailKeys.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }))
      for (const queryKey of detailKeys)
        queryClient.setQueriesData<IssueDetail>({ queryKey }, (data) =>
          data ? removeRelation(data, relationId) : data,
        )
      return { previous }
    },
    onError: (error, _relationId, context) => {
      for (const [queryKey, data] of context?.previous ?? [])
        queryClient.setQueryData(queryKey, data)
      toast.error("Couldn't remove the relation", { description: errorMessage(error) })
    },
    onSettled: () => invalidateRelationViews(queryClient),
  })
}

/** Issues matching a title or identifier search, for the relation picker. */
export const issueSearchOptions = (workspaceSlug: string, q: string) =>
  orpc.issues.list.queryOptions({
    input: { workspaceSlug, q: q || undefined, sort: 'updatedAt', limit: 20 },
    placeholderData: keepPreviousData,
  })

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
        queryClient.invalidateQueries({ queryKey: issueFacetsKey() }),
        ...detailKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        queryClient.invalidateQueries({ queryKey: orpc.activity.list.key() }),
        // Project and cycle progress count issues by status, project and cycle.
        queryClient.invalidateQueries({ queryKey: projectsKey() }),
        queryClient.invalidateQueries({ queryKey: cyclesKey() }),
      ])
    },
  })
}

/**
 * Deletes an issue, dropping it from every list page at once; restored with a
 * toast if the server refuses.
 */
export function useDeleteIssue(workspaceSlug: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const listKey = issueInfiniteListKey()

  return useMutation({
    mutationFn: ({ id }: { id: string; identifier: string }) =>
      client.issues.delete({ workspaceSlug: toValue(workspaceSlug), id }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueriesData<InfiniteData<IssuePage>>({ queryKey: listKey })
      queryClient.setQueriesData<InfiniteData<IssuePage>>({ queryKey: listKey }, (data) =>
        removeIssueFromPages(data, id),
      )
      return { previous }
    },
    onError: (error, { identifier }, context) => {
      for (const [queryKey, data] of context?.previous ?? [])
        queryClient.setQueryData(queryKey, data)
      toast.error(`Couldn't delete ${identifier}`, { description: errorMessage(error) })
    },
    onSuccess: (_, { id, identifier }) => {
      for (const queryKey of issueDetailKeys())
        queryClient.removeQueries({
          queryKey,
          predicate: (query) => (query.state.data as Issue | undefined)?.id === id,
        })
      toast.success(`${identifier} deleted`)
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey }),
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
