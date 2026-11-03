import type {
  Issue,
  IssuePage,
  ListIssuesInput,
  RealtimeEvent,
  RealtimeIssueField,
} from '@linear/contract'
import type { InfiniteData, Query, QueryClient } from '@tanstack/vue-query'
import { projectsKey } from '@/features/projects/queries'
import { removeIssueFromPages } from '@/features/issues/issue-cache'
import { templatesKey } from '@/features/templates/queries'
import { issueDetailKeys, issueListKey, writeIssueToCaches } from '@/features/issues/queries'
import { client, orpc } from '@/lib/orpc'

// Fields that decide which lists an issue is in (My Issues, project); a status change
// only regroups, which the patched copy already does.
const MEMBERSHIP_FIELDS: RealtimeIssueField[] = ['assignee', 'project']
// Whether a list with this input may gain, lose or reorder an issue when these
// fields change: only filtered or sorted lists depend on more than membership.
function listDependsOn(input: Partial<ListIssuesInput>, fields: Set<RealtimeIssueField>) {
  return (
    input.sort === 'updatedAt' ||
    (fields.has('status') && (!!input.statusIds?.length || !!input.statusCategories?.length)) ||
    (fields.has('priority') && (!!input.priorities?.length || input.sort === 'priority')) ||
    (fields.has('labels') && !!input.labelIds?.length) ||
    (fields.has('subscribers') && !!input.subscriberIds?.length) ||
    (fields.has('title') && !!input.q) ||
    // Gaining or losing a parent moves the issue in or out of lists that hide sub-issues.
    (fields.has('parent') && (input.showSubIssues === false || !!input.excludeSubtreeOf))
  )
}
const listInput = (query: Query) =>
  (query.queryKey[1] as { input?: Partial<ListIssuesInput> } | undefined)?.input ?? {}
// Fields that change project progress counts.
const PROGRESS_FIELDS: RealtimeIssueField[] = ['status', 'project']
// Bursts (a PR merge touching several issues) coalesce into one list refetch.
const COALESCE_MS = 300

type Deps = {
  queryClient: QueryClient
  workspaceSlug: string
  fetchIssue?: (id: string) => Promise<Issue>
}

/**
 * Applies a teammate's (or automation's) change to the TanStack Query caches.
 * Updated issues are fetched once and patched into every cached copy, so lists,
 * board and detail change without refetching whole lists; lists are refetched only
 * when the issue may have entered or left them.
 */
export function createRealtimeEventHandler({
  queryClient,
  workspaceSlug,
  fetchIssue = (id) => client.issues.get({ workspaceSlug, id }),
}: Deps) {
  const pending = new Set<'lists' | 'projects'>()
  // Changed fields that only matter to filtered or sorted lists.
  const pendingFields = new Set<RealtimeIssueField>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    timer = undefined
    if (pending.has('lists')) void queryClient.invalidateQueries({ queryKey: issueListKey() })
    else if (pendingFields.size) invalidateDependentLists(new Set(pendingFields))
    if (pending.has('projects')) void queryClient.invalidateQueries({ queryKey: projectsKey() })
    pending.clear()
    pendingFields.clear()
  }

  function invalidateSoon(...what: ('lists' | 'projects')[]) {
    what.forEach((w) => pending.add(w))
    timer ??= setTimeout(flush, COALESCE_MS)
  }

  function invalidateFieldsSoon(fields: RealtimeIssueField[]) {
    fields.forEach((f) => pendingFields.add(f))
    timer ??= setTimeout(flush, COALESCE_MS)
  }

  function invalidateDependentLists(fields: Set<RealtimeIssueField>) {
    const predicate = (query: Query) => listDependsOn(listInput(query), fields)
    if (!queryClient.getQueryCache().findAll({ queryKey: issueListKey(), predicate }).length) return
    void queryClient.invalidateQueries({ queryKey: issueListKey(), predicate })
  }

  async function onIssueUpdated(issueId: string, fields: RealtimeIssueField[]) {
    void queryClient.invalidateQueries({ queryKey: orpc.activity.list.key({ input: { issueId } }) })
    if (fields.includes('subscribers')) invalidateSubscribers(issueId)
    if (fields.includes('pullRequests')) {
      void queryClient.invalidateQueries({
        queryKey: orpc.github.pullRequests.listForIssue.key({ input: { issueId } }),
      })
    }
    if (fields.some((f) => MEMBERSHIP_FIELDS.includes(f))) invalidateSoon('lists')
    else invalidateFieldsSoon(fields)
    if (fields.some((f) => PROGRESS_FIELDS.includes(f))) invalidateSoon('projects')

    // While this tab has its own edits in flight, their settle refetches everything;
    // patching now would fight the optimistic values.
    if (queryClient.isMutating({ mutationKey: orpc.issues.update.mutationKey() }) > 0) return
    try {
      const issue = await fetchIssue(issueId)
      writeIssueToCaches(queryClient, issueId, () => issue)
    } catch {
      // Deleted or briefly unreachable: let the queries sort it out.
      invalidateIssue(issueId)
    }
  }

  function invalidateSubscribers(issueId: string) {
    void queryClient.invalidateQueries({
      queryKey: orpc.issues.subscribers.key({ input: { issueId } }),
    })
  }

  function invalidateIssue(issueId: string) {
    for (const queryKey of issueDetailKeys()) {
      void queryClient.invalidateQueries({
        queryKey,
        predicate: (query) => (query.state.data as Issue | undefined)?.id === issueId,
      })
    }
  }

  return function handle(event: RealtimeEvent) {
    switch (event.type) {
      case 'issue.created':
        return invalidateSoon('lists', 'projects')
      case 'issue.updated':
        return void onIssueUpdated(event.issueId, event.fields)
      case 'issue.deleted':
        queryClient.setQueriesData<InfiniteData<IssuePage>>(
          { queryKey: orpc.issues.list.key({ type: 'infinite' }) },
          (data) => removeIssueFromPages(data, event.issueId),
        )
        invalidateIssue(event.issueId)
        return invalidateSoon('projects')
      case 'comment.created':
        // Commenting subscribes the author (and flips their `isSubscribed`).
        invalidateSubscribers(event.issueId)
        invalidateIssue(event.issueId)
        return void queryClient.invalidateQueries({
          queryKey: orpc.comments.list.key({ input: { issueId: event.issueId } }),
        })
      case 'comment.updated':
      case 'comment.deleted':
        return void queryClient.invalidateQueries({
          queryKey: orpc.comments.list.key({ input: { issueId: event.issueId } }),
        })
      case 'template.updated':
        return void queryClient.invalidateQueries({ queryKey: templatesKey() })
      case 'presence.changed':
        return void queryClient.invalidateQueries({ queryKey: orpc.presence.list.key() })
    }
  }
}
