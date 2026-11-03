import type {
  Issue,
  IssueDetail,
  IssuePage,
  IssueRelationType,
  ListIssuesInput,
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
import { projectsKey } from '@/features/projects/queries'
import { client, orpc } from '@/lib/orpc'
import {
  applyIssuePatch,
  patchIssue,
  patchIssueInPages,
  removeRelation,
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
    queryClient.setQueriesData<IssueDetail>({ queryKey }, (data) =>
      patchIssue(data, id, (current) => ({ ...current, ...update(current) })),
    )
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
