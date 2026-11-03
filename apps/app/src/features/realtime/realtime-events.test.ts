// @vitest-environment happy-dom
import type { Issue, IssuePage, WorkflowStatus } from '@linear/contract'
import { QueryClient, type InfiniteData } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toValue } from 'vue'
import { EMPTY_FILTERS, type IssueFilters } from '@/features/issues/issue-filters'
import { issueFacetsOptions, issueListOptions } from '@/features/issues/queries'
import { orpc } from '@/lib/orpc'
import { createRealtimeEventHandler } from './realtime-events'
import { backoffDelay } from './useRealtime'

const status = (name: string, category: WorkflowStatus['category']): WorkflowStatus => ({
  id: crypto.randomUUID(),
  name,
  category,
  position: 1,
})
const todo = status('Todo', 'unstarted')
const inProgress = status('In Progress', 'started')

function issue(id: string, overrides: Partial<Issue> = {}): Issue {
  const created = new Date('2026-01-01')
  return {
    id,
    identifier: `TIP-${id}`,
    number: 1,
    teamId: 'team',
    title: id,
    description: null,
    status: todo,
    priority: 0,
    assigneeId: null,
    creatorId: 'user',
    projectId: null,
    estimate: null,
    dueDate: null,
    labels: [],
    isSubscribed: false,
    createdAt: created,
    updatedAt: created,
    completedAt: null,
    parentId: null,
    subIssueProgress: null,
    ...overrides,
  }
}

const listKey = issueListOptions('tip').queryKey
const detailKey = orpc.issues.getByIdentifier.queryKey({
  input: { workspaceSlug: 'tip', identifier: 'TIP-a' },
})
const actor = { actorId: crypto.randomUUID() }

let queryClient: QueryClient
beforeEach(() => {
  vi.useFakeTimers()
  queryClient = new QueryClient()
  queryClient.setQueryData<InfiniteData<IssuePage>>(listKey, {
    pages: [{ items: [issue('a'), issue('b')], nextCursor: null }],
    pageParams: [null],
  })
  queryClient.setQueryData(detailKey, { ...issue('a'), parent: null, children: [] })
})
afterEach(() => vi.useRealTimers())

const listed = () => queryClient.getQueryData<InfiniteData<IssuePage>>(listKey)!.pages[0]!.items

describe('realtime event handler', () => {
  it('patches an updated issue into the list and detail caches', async () => {
    const fetchIssue = vi.fn(async (id: string) => issue(id, { status: inProgress }))
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip', fetchIssue })

    handle({ type: 'issue.updated', issueId: 'a', fields: ['status'], ...actor })
    await vi.waitFor(() => expect(listed()[0]!.status).toEqual(inProgress))

    expect(fetchIssue).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData<Issue>(detailKey)!.status).toEqual(inProgress)
    expect(listed()[1]!.status).toEqual(todo)
  })

  it("refetches the issue's linked pull requests when GitHub changes them", () => {
    const fetchIssue = vi.fn(async (id: string) => issue(id))
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip', fetchIssue })
    const prKey = orpc.github.pullRequests.listForIssue.queryKey({
      input: { workspaceSlug: 'tip', issueId: 'a' },
    })
    queryClient.setQueryData(prKey, [])

    handle({ type: 'issue.updated', issueId: 'a', fields: ['title'], ...actor })
    expect(queryClient.getQueryState(prKey)!.isInvalidated).toBe(false)
    handle({ type: 'issue.updated', issueId: 'a', fields: ['pullRequests'], actorId: null })
    expect(queryClient.getQueryState(prKey)!.isInvalidated).toBe(true)
  })

  it('refetches lists, coalesced, only when the issue may join or leave one', async () => {
    const fetchIssue = vi.fn(async (id: string) => issue(id))
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip', fetchIssue })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const listKeyPrefix = JSON.stringify(orpc.issues.list.key())
    const listInvalidations = () =>
      invalidate.mock.calls.filter(
        ([filters]) => JSON.stringify(toValue(filters)?.queryKey) === listKeyPrefix,
      )

    handle({ type: 'issue.updated', issueId: 'a', fields: ['status'], ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(listInvalidations()).toHaveLength(0)

    handle({ type: 'issue.updated', issueId: 'a', fields: ['assignee'], ...actor })
    handle({ type: 'issue.created', issueId: 'c', ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(listInvalidations()).toHaveLength(1)
  })

  it('refetches only the filtered or sorted lists a change can affect', async () => {
    const fetchIssue = vi.fn(async (id: string) => issue(id))
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip', fetchIssue })
    const keyFor = (filters: Partial<IssueFilters>) =>
      issueListOptions('tip', {}, { ...EMPTY_FILTERS, ...filters }).queryKey
    const byStatus = keyFor({ statusIds: [todo.id] })
    const byPriority = keyFor({ sort: 'priority' })
    const byTitle = keyFor({ q: 'login' })
    // An Active / Backlog tab: a status change can move the issue between tabs.
    const activeTab = issueListOptions('tip', {
      statusCategories: ['started', 'unstarted'],
    }).queryKey
    for (const key of [byStatus, byPriority, byTitle, activeTab]) {
      queryClient.setQueryData<InfiniteData<IssuePage>>(key, {
        pages: [{ items: [issue('a')], nextCursor: null }],
        pageParams: [null],
      })
    }
    const stale = (key: readonly unknown[]) => queryClient.getQueryState(key)!.isInvalidated

    handle({ type: 'issue.updated', issueId: 'a', fields: ['status'], ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect([
      stale(listKey),
      stale(byStatus),
      stale(byPriority),
      stale(byTitle),
      stale(activeTab),
    ]).toEqual([false, true, false, false, true])

    handle({ type: 'issue.updated', issueId: 'a', fields: ['priority', 'title'], ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect([stale(listKey), stale(byPriority), stale(byTitle)]).toEqual([false, true, true])

    const byEstimate = keyFor({ estimates: [null] })
    queryClient.setQueryData<InfiniteData<IssuePage>>(byEstimate, {
      pages: [{ items: [issue('a')], nextCursor: null }],
      pageParams: [null],
    })
    handle({ type: 'issue.updated', issueId: 'a', fields: ['estimate'], ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect([stale(listKey), stale(byEstimate)]).toEqual([false, true])
    const overdue = keyFor({ due: ['overdue'] })
    const byDueDate = keyFor({ sort: 'dueDate' })
    for (const key of [overdue, byDueDate]) {
      queryClient.setQueryData<InfiniteData<IssuePage>>(key, {
        pages: [{ items: [issue('a')], nextCursor: null }],
        pageParams: [null],
      })
    }
    // Finishing an issue takes it out of Overdue; a new due date reorders and refilters.
    handle({ type: 'issue.updated', issueId: 'a', fields: ['status'], ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect([stale(overdue), stale(byDueDate)]).toEqual([true, false])
    handle({ type: 'issue.updated', issueId: 'a', fields: ['dueDate'], ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(stale(byDueDate)).toBe(true)
  })

  it('refetches the Details panel counts, coalesced, when they can change', async () => {
    const handle = createRealtimeEventHandler({
      queryClient,
      workspaceSlug: 'tip',
      fetchIssue: async (id) => issue(id),
    })
    const facets = issueFacetsOptions('tip', { teamId: 'team' }).queryKey
    queryClient.setQueryData(facets, { assignees: [], labels: [], priorities: [], projects: [] })
    const stale = () => queryClient.getQueryState(facets)!.isInvalidated

    handle({ type: 'issue.updated', issueId: 'a', fields: ['description'], ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(stale()).toBe(false)

    handle({ type: 'issue.updated', issueId: 'a', fields: ['labels'], ...actor })
    handle({ type: 'issue.updated', issueId: 'b', fields: ['assignee'], ...actor })
    expect(stale()).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(stale()).toBe(true)

    for (const event of [
      { type: 'issue.created' as const, issueId: 'c', ...actor },
      { type: 'issue.deleted' as const, issueId: 'c', ...actor },
    ]) {
      queryClient.setQueryData(facets, { assignees: [], labels: [], priorities: [], projects: [] })
      handle(event)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(stale()).toBe(true)
    }
  })

  it("leaves caches alone while this tab's own edit is in flight", async () => {
    const fetchIssue = vi.fn(async (id: string) => issue(id, { status: inProgress }))
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip', fetchIssue })
    vi.spyOn(queryClient, 'isMutating').mockReturnValue(1)

    handle({ type: 'issue.updated', issueId: 'a', fields: ['status'], ...actor })
    await vi.advanceTimersByTimeAsync(10)

    expect(fetchIssue).not.toHaveBeenCalled()
    expect(listed()[0]!.status).toEqual(todo)
  })

  it('refetches presence when a teammate presence changes', () => {
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    handle({ type: 'presence.changed', userId: crypto.randomUUID() })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orpc.presence.list.key() })
  })

  it('removes a deleted issue from lists', () => {
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip' })
    handle({ type: 'issue.deleted', issueId: 'a', ...actor })
    expect(listed().map((i) => i.id)).toEqual(['b'])
  })

  it('refetches project queries, coalesced, on project events', async () => {
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    handle({ type: 'project.updated', projectId: crypto.randomUUID(), ...actor })
    handle({ type: 'project.updated', projectId: crypto.randomUUID(), ...actor })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(invalidate.mock.calls).toEqual([[{ queryKey: orpc.projects.key() }]])
  })

  it("refetches only that issue's comments on a comment event", () => {
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    handle({ type: 'comment.created', issueId: 'a', commentId: crypto.randomUUID(), ...actor })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: orpc.comments.list.key({ input: { issueId: 'a' } }),
    })
  })

  it('refetches template lists on a template event', () => {
    const handle = createRealtimeEventHandler({ queryClient, workspaceSlug: 'tip' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    handle({ type: 'template.updated', templateId: crypto.randomUUID(), ...actor })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orpc.templates.key() })
  })
})

describe('backoffDelay', () => {
  it('doubles from 1 s up to 30 s, with jitter between half and the full delay', () => {
    expect([0, 1, 2, 3, 10].map((n) => backoffDelay(n, () => 1))).toEqual([
      1_000, 2_000, 4_000, 8_000, 30_000,
    ])
    expect(backoffDelay(0, () => 0)).toBe(500)
  })
})
