import type {
  Issue,
  IssuePage,
  ListIssuesInput,
  RealtimeEvent,
  RealtimeIssueField,
} from '@linear/contract'
import type { InfiniteData, Query, QueryClient } from '@tanstack/vue-query'
import { cyclesKey } from '@/features/cycles/queries'
import { invalidateProjects } from '@/features/projects/queries'
import { removeIssueFromPages } from '@/features/issues/issue-cache'
import { notificationsKey } from '@/features/inbox/queries'
import { templatesKey } from '@/features/templates/queries'
import { viewsKey } from '@/features/views/queries'
import {
  issueDetailKeys,
  issueFacetsKey,
  issueListKey,
  writeIssueToCaches,
} from '@/features/issues/queries'
import { client, orpc } from '@/lib/orpc'
import { setTyping } from './typing'

// Fields that decide which lists an issue is in (My Issues, project, cycle); a status
// change only regroups, which the patched copy already does.
const MEMBERSHIP_FIELDS: RealtimeIssueField[] = ['assignee', 'project', 'cycle']
// Whether a list with this input may gain, lose or reorder an issue when these
// fields change: only filtered or sorted lists depend on more than membership.
function listDependsOn(input: Partial<ListIssuesInput>, fields: Set<RealtimeIssueField>) {
  return (
    input.sort === 'updatedAt' ||
    // Any change bumps `updatedAt`.
    !!input.updatedAfter ||
    !!input.updatedBefore ||
    (fields.has('status') &&
      (!!input.statusIds?.length ||
        !!input.statusIdsNot?.length ||
        !!input.statusCategories?.length ||
        // Completing or reopening sets or clears `completedAt`.
        !!input.completedAfter ||
        !!input.completedSince ||
        !!input.completedBefore ||
        !!input.due?.includes('overdue'))) ||
    (fields.has('dueDate') && (!!input.due?.length || input.sort === 'dueDate')) ||
    (fields.has('priority') &&
      (!!input.priorities?.length || !!input.prioritiesNot?.length || input.sort === 'priority')) ||
    (fields.has('labels') && (!!input.labelIds?.length || !!input.labelIdsNot?.length)) ||
    ((fields.has('title') || fields.has('description')) && !!input.content) ||
    (fields.has('pullRequests') && input.hasPullRequests !== undefined) ||
    (fields.has('milestone') && (!!input.milestoneIds?.length || !!input.milestoneId)) ||
    (fields.has('estimate') && (!!input.estimates?.length || input.sort === 'estimate')) ||
    (fields.has('subscribers') && !!input.subscriberIds?.length) ||
    (fields.has('title') && !!input.q) ||
    ((fields.has('links') || fields.has('pullRequests')) && input.hasLinks !== undefined) ||
    // Gaining or losing a parent moves the issue in or out of lists that hide sub-issues.
    (fields.has('parent') && (input.showSubIssues === false || !!input.excludeSubtreeOf))
  )
}
const listInput = (query: Query) =>
  (query.queryKey[1] as { input?: Partial<ListIssuesInput> } | undefined)?.input ?? {}
// Fields that change the Details panel's counts, or which issues a filtered view counts.
const FACET_FIELDS: RealtimeIssueField[] = [
  'assignee',
  'labels',
  'priority',
  'project',
  'milestone',
  'status',
  'title',
  'cycle',
  'dueDate',
  'estimate',
  'subscribers',
  'parent',
]
// Fields that change project, milestone and cycle progress counts.
const PROGRESS_FIELDS: RealtimeIssueField[] = ['status', 'project', 'milestone', 'cycle']
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
  // `cycles` refreshes cycle progress; only issue changes move it.
  type Pending = 'lists' | 'projects' | 'cycles' | 'facets'
  const pending = new Set<Pending>()
  // Changed fields that only matter to filtered or sorted lists.
  const pendingFields = new Set<RealtimeIssueField>()
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    timer = undefined
    if (pending.has('lists')) void queryClient.invalidateQueries({ queryKey: issueListKey() })
    else if (pendingFields.size) invalidateDependentLists(new Set(pendingFields))
    if (pending.has('projects')) void invalidateProjects(queryClient)
    if (pending.has('cycles')) void queryClient.invalidateQueries({ queryKey: cyclesKey() })
    if (pending.has('facets')) void queryClient.invalidateQueries({ queryKey: issueFacetsKey() })
    pending.clear()
    pendingFields.clear()
  }

  function invalidateSoon(...what: Pending[]) {
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

  // Other fields (description, links, PRs, …) only matter to counts filtered on them.
  function invalidateDependentFacets(fields: RealtimeIssueField[]) {
    const changed = new Set(fields)
    const predicate = (query: Query) => listDependsOn(listInput(query), changed)
    if (!queryClient.getQueryCache().findAll({ queryKey: issueFacetsKey(), predicate }).length)
      return
    void queryClient.invalidateQueries({ queryKey: issueFacetsKey(), predicate })
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
    if (fields.some((f) => PROGRESS_FIELDS.includes(f))) invalidateSoon('projects', 'cycles')
    if (fields.some((f) => FACET_FIELDS.includes(f))) invalidateSoon('facets')
    else invalidateDependentFacets(fields)

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

  function invalidateInbox() {
    void queryClient.invalidateQueries({ queryKey: notificationsKey() })
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
        return invalidateSoon('lists', 'projects', 'cycles', 'facets')
      case 'issue.updated':
        // Inbox rows show the issue's title and status.
        if (event.fields.includes('title') || event.fields.includes('status')) invalidateInbox()
        return void onIssueUpdated(event.issueId, event.fields)
      case 'issue.deleted':
        // Its notifications are deleted with it.
        invalidateInbox()
        queryClient.setQueriesData<InfiniteData<IssuePage>>(
          { queryKey: orpc.issues.list.key({ type: 'infinite' }) },
          (data) => removeIssueFromPages(data, event.issueId),
        )
        invalidateIssue(event.issueId)
        return invalidateSoon('projects', 'cycles', 'facets')
      case 'project.updated':
        // Project lists and pages refetch (coalesced); this tab's own edits never echo.
        return invalidateSoon('projects')
      case 'comment.typing':
        // Ephemeral: only the "is typing…" line under the timeline changes.
        return setTyping(event.issueId, event.userId, event.typing)
      case 'comment.created':
        // Their comment is in, so they're no longer typing it.
        if (event.actorId) setTyping(event.issueId, event.actorId, false)
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
      case 'view.updated':
      case 'view.deleted':
        // View lists and pages refetch; favorites show the view's name and icon.
        void queryClient.invalidateQueries({ queryKey: orpc.favorites.key() })
        return void queryClient.invalidateQueries({ queryKey: viewsKey() })
      case 'presence.changed':
        return void queryClient.invalidateQueries({ queryKey: orpc.presence.list.key() })
      case 'notification.created':
        // Only ever sent to the recipient: refresh the Inbox and the unread badge.
        return invalidateInbox()
    }
  }
}
