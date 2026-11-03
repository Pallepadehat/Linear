// @vitest-environment happy-dom
import type { Issue, IssuePage, Label, WorkflowStatus } from '@linear/contract'
import { QueryClient, type InfiniteData } from '@tanstack/vue-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { orpc } from '@/lib/orpc'
import { applyBulkChange, toBulkUpdateInput } from './issue-cache'
import { issueListOptions, removeIssuesOptimistically, writeIssuesOptimistically } from './queries'

const status = (name: string, category: WorkflowStatus['category']): WorkflowStatus => ({
  id: crypto.randomUUID(),
  name,
  category,
  position: 1,
})
const todo = status('Todo', 'unstarted')
const done = status('Done', 'completed')
const label = (name: string): Label => ({
  id: crypto.randomUUID(),
  name,
  color: '#5e6ad2',
  teamId: null,
})
const bug = label('Bug')
const ui = label('UI')

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
    cycleId: null,
    estimate: null,
    dueDate: null,
    labels: [],
    isSubscribed: false,
    createdAt: created,
    updatedAt: created,
    completedAt: null,
    blockedByCount: 0,
    blockingCount: 0,
    parentId: null,
    subIssueProgress: null,
    ...overrides,
  }
}

describe('applyBulkChange', () => {
  const now = new Date('2026-11-03T12:00:00Z')

  it('sets the shared properties and completedAt like a single update', () => {
    const next = applyBulkChange(issue('a'), { status: done, priority: 1, assigneeId: 'u' }, now)
    expect(next).toMatchObject({ status: done, priority: 1, assigneeId: 'u', completedAt: now })
  })

  it("adds and removes labels on each issue's own set, sorted by name", () => {
    const next = applyBulkChange(issue('a', { labels: [ui] }), { addLabels: [bug, ui] }, now)
    expect(next.labels).toEqual([bug, ui])
    expect(applyBulkChange(next, { removeLabelIds: [ui.id] }, now).labels).toEqual([bug])
  })

  it('maps to the bulk input, leaving out what does not change', () => {
    expect(toBulkUpdateInput('tip', ['a'], { addLabels: [bug], removeLabelIds: [] })).toEqual({
      workspaceSlug: 'tip',
      ids: ['a'],
      patch: { addLabelIds: [bug.id] },
    })
    expect(toBulkUpdateInput('tip', ['a'], { assigneeId: null }).patch).toEqual({
      assigneeId: null,
    })
  })
})

describe('optimistic bulk cache writes', () => {
  const listKey = issueListOptions('tip').queryKey
  const boardKey = issueListOptions('tip', { teamId: 'team' }).queryKey
  const detailKey = orpc.issues.getByIdentifier.queryKey({
    input: { workspaceSlug: 'tip', identifier: 'TIP-a' },
  })
  const pages = (items: Issue[]): InfiniteData<IssuePage> => ({
    pages: [{ items, nextCursor: null }],
    pageParams: [null],
  })
  const listed = (key: typeof listKey) =>
    queryClient.getQueryData<InfiniteData<IssuePage>>(key)!.pages[0]!.items

  let queryClient: QueryClient
  beforeEach(() => {
    queryClient = new QueryClient()
    queryClient.setQueryData<InfiniteData<IssuePage>>(
      listKey,
      pages([issue('a'), issue('b'), issue('c')]),
    )
    queryClient.setQueryData<InfiniteData<IssuePage>>(boardKey, pages([issue('b')]))
    queryClient.setQueryData(detailKey, {
      ...issue('a'),
      parent: null,
      children: [],
      relations: { blocks: [], blockedBy: [], related: [], duplicateOf: [], duplicates: [] },
    })
  })

  it('patches every list, board and detail cache, then rolls all of them back', async () => {
    const rollback = await writeIssuesOptimistically(queryClient, ['a', 'b'], (i) =>
      applyBulkChange(i, { status: done }),
    )
    expect(listed(listKey).map((i) => i.status.name)).toEqual(['Done', 'Done', 'Todo'])
    expect(listed(boardKey)[0]!.status).toEqual(done)
    expect(queryClient.getQueryData<Issue>(detailKey)!.status).toEqual(done)

    rollback()
    expect(listed(listKey).map((i) => i.status.name)).toEqual(['Todo', 'Todo', 'Todo'])
    expect(listed(boardKey)[0]!.status).toEqual(todo)
    expect(queryClient.getQueryData<Issue>(detailKey)!.status).toEqual(todo)
  })

  it('removes deleted issues from every list and puts them back on rollback', async () => {
    const rollback = await removeIssuesOptimistically(queryClient, ['a', 'b'])
    expect(listed(listKey).map((i) => i.id)).toEqual(['c'])
    expect(listed(boardKey)).toEqual([])

    rollback()
    expect(listed(listKey).map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(listed(boardKey).map((i) => i.id)).toEqual(['b'])
  })
})
