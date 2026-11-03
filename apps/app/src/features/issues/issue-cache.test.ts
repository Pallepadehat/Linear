import type { Issue, IssuePage, WorkflowStatus } from '@linear/contract'
import type { InfiniteData } from '@tanstack/vue-query'
import { describe, expect, it } from 'vitest'
import {
  applyIssuePatch,
  patchIssue,
  patchIssueInPages,
  removeIssueFromPages,
  removeLink,
  removeRelation,
  upsertLink,
  toUpdateIssueInput,
} from './issue-cache'

const status = (name: string, category: WorkflowStatus['category']): WorkflowStatus => ({
  id: crypto.randomUUID(),
  name,
  category,
  position: 1,
})

const todo = status('Todo', 'unstarted')
const done = status('Done', 'completed')
const canceled = status('Canceled', 'canceled')
const bug = { id: crypto.randomUUID(), teamId: null, name: 'Bug', color: '#eb5757' }

function issue(id: string, overrides: Partial<Issue> = {}): Issue {
  const created = new Date('2026-01-01')
  return {
    id,
    identifier: `TIP-${id}`,
    number: 1,
    teamId: crypto.randomUUID(),
    title: id,
    description: null,
    status: todo,
    priority: 0,
    assigneeId: null,
    creatorId: crypto.randomUUID(),
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
    project: null,
    pullRequests: [],
    linkCount: 0,
    parentId: null,
    subIssueProgress: null,
    ...overrides,
  }
}

const pages = (...items: Issue[][]): InfiniteData<IssuePage> => ({
  pages: items.map((page) => ({ items: page, nextCursor: null })),
  pageParams: items.map(() => null),
})

describe('applyIssuePatch', () => {
  const now = new Date('2026-02-01')

  it('applies the changed properties and bumps updatedAt', () => {
    const next = applyIssuePatch(issue('a'), { priority: 1, labels: [bug] }, now)
    expect(next).toMatchObject({ priority: 1, labels: [bug], status: todo, updatedAt: now })
  })

  it('sets completedAt when entering a completed status', () => {
    expect(applyIssuePatch(issue('a'), { status: done }, now).completedAt).toEqual(now)
  })

  it('keeps completedAt when moving between completed statuses', () => {
    const completedAt = new Date('2026-01-15')
    const next = applyIssuePatch(issue('a', { status: done, completedAt }), { status: done }, now)
    expect(next.completedAt).toEqual(completedAt)
  })

  it('clears completedAt when leaving completed', () => {
    const completed = issue('a', { status: done, completedAt: now })
    expect(applyIssuePatch(completed, { status: canceled }, now).completedAt).toBeNull()
  })

  it('drops the project summary when the project changes', () => {
    const launch = { id: crypto.randomUUID(), name: 'Launch', iconUploadId: null }
    const inLaunch = issue('a', { projectId: launch.id, project: launch })
    expect(applyIssuePatch(inLaunch, { projectId: launch.id }, now).project).toEqual(launch)
    expect(applyIssuePatch(inLaunch, { projectId: crypto.randomUUID() }, now).project).toBeNull()
    expect(applyIssuePatch(inLaunch, { projectId: null }, now).project).toBeNull()
  })

  it('leaves completedAt alone when the status is unchanged', () => {
    const completed = issue('a', { status: done, completedAt: now })
    expect(applyIssuePatch(completed, { assigneeId: null }, now).completedAt).toEqual(now)
  })
})

describe('patchIssueInPages', () => {
  const setUrgent = (i: Issue) => ({ ...i, priority: 1 })

  it('replaces the issue in whichever page holds it', () => {
    const data = pages([issue('a'), issue('b')], [issue('c')])
    const next = patchIssueInPages(data, 'c', setUrgent)
    expect(next?.pages[1]?.items[0]?.priority).toBe(1)
    // Untouched pages keep their identity.
    expect(next?.pages[0]).toBe(data.pages[0])
    expect(data.pages[1]?.items[0]?.priority).toBe(0)
  })

  it('returns the same object when the issue is not loaded', () => {
    const data = pages([issue('a')])
    expect(patchIssueInPages(data, 'z', setUrgent)).toBe(data)
    expect(patchIssueInPages(undefined, 'a', setUrgent)).toBeUndefined()
  })
})

describe('patchIssue', () => {
  it('patches only the matching detail entry', () => {
    const a = issue('a')
    expect(patchIssue(a, 'a', (i) => ({ ...i, priority: 2 }))?.priority).toBe(2)
    expect(patchIssue(a, 'b', (i) => ({ ...i, priority: 2 }))).toBe(a)
  })

  it('patches a sub-issue inside its parent and recounts the progress', () => {
    const parent = {
      ...issue('p', { subIssueProgress: { done: 0, total: 2 } }),
      parent: null,
      children: [issue('a'), issue('b')],
    }
    const next = patchIssue(parent, 'a', (i) => ({ ...i, status: done }))
    expect(next?.children.find((c) => c.id === 'a')?.status).toBe(done)
    expect(next?.subIssueProgress).toEqual({ done: 1, total: 2 })
    expect(patchIssue(parent, 'b', (i) => ({ ...i, status: canceled }))?.subIssueProgress).toEqual({
      done: 0,
      total: 1,
    })
  })

  it('keeps the parent and sub-issues when patching the issue itself', () => {
    const parent = { ...issue('p'), parent: null, children: [issue('a')] }
    expect(patchIssue(parent, 'p', (i) => ({ ...issue(i.id), priority: 3 }))).toMatchObject({
      priority: 3,
      children: [{ id: 'a' }],
    })
  })
})

describe('toUpdateIssueInput', () => {
  it('sends only the changed fields, as ids', () => {
    expect(toUpdateIssueInput('tip', 'a', { status: done, labels: [bug] })).toEqual({
      workspaceSlug: 'tip',
      id: 'a',
      statusId: done.id,
      labelIds: [bug.id],
    })
  })

  it('keeps falsy values that clear a property', () => {
    expect(toUpdateIssueInput('tip', 'a', { priority: 0, assigneeId: null, labels: [] })).toEqual({
      workspaceSlug: 'tip',
      id: 'a',
      priority: 0,
      assigneeId: null,
      labelIds: [],
    })
  })

  it('sends cycle changes, including clears', () => {
    expect(toUpdateIssueInput('tip', 'a', { cycleId: 'c1' })).toMatchObject({ cycleId: 'c1' })
    expect(toUpdateIssueInput('tip', 'a', { cycleId: null })).toMatchObject({ cycleId: null })
  })

  it('sends title, description and project edits, including clears', () => {
    expect(
      toUpdateIssueInput('tip', 'a', { title: 'New', description: null, projectId: null }),
    ).toEqual({ workspaceSlug: 'tip', id: 'a', title: 'New', description: null, projectId: null })
  })

  it('sends estimates, including clearing one', () => {
    expect(toUpdateIssueInput('tip', 'a', { estimate: 3 })).toEqual({
      workspaceSlug: 'tip',
      id: 'a',
      estimate: 3,
    })
    expect(toUpdateIssueInput('tip', 'a', { estimate: null })).toEqual({
      workspaceSlug: 'tip',
      id: 'a',
      estimate: null,
    })
  })
})

describe('removeIssueFromPages', () => {
  it('drops the issue from whichever page holds it', () => {
    const data = pages([issue('a'), issue('b')], [issue('c')])
    expect(removeIssueFromPages(data, 'b')!.pages.map((p) => p.items.map((i) => i.id))).toEqual([
      ['a'],
      ['c'],
    ])
  })

  it('returns the same object when the issue is not loaded', () => {
    const data = pages([issue('a')])
    expect(removeIssueFromPages(data, 'z')).toBe(data)
    expect(removeIssueFromPages(undefined, 'z')).toBeUndefined()
  })
})

describe('removeRelation', () => {
  it('drops the relation from whichever group lists it', () => {
    const related = (relationId: string) => ({
      relationId,
      id: crypto.randomUUID(),
      identifier: 'TIP-9',
      title: 'Other',
      status: todo,
    })
    const detail = {
      ...issue('a'),
      parent: null,
      children: [],
      relations: {
        blocks: [related('r1')],
        blockedBy: [related('r2')],
        related: [],
        duplicateOf: [],
        duplicates: [],
      },
      links: [],
    }
    const next = removeRelation(detail, 'r2')
    expect(next.relations.blockedBy).toEqual([])
    expect(next.relations.blocks).toEqual(detail.relations.blocks)
  })
})

describe('upsertLink / removeLink', () => {
  const link = (id: string, title = 'Spec') => ({
    id,
    url: 'https://x.dev',
    title,
    hostname: 'x.dev',
    createdAt: new Date(0),
  })
  const detail = {
    ...issue('a'),
    parent: null,
    children: [],
    relations: { blocks: [], blockedBy: [], related: [], duplicateOf: [], duplicates: [] },
    links: [link('l1')],
  }

  it('appends a new link and replaces an existing one in place', () => {
    const added = upsertLink(detail, link('l2'))
    expect(added.links.map((l) => l.id)).toEqual(['l1', 'l2'])
    const renamed = upsertLink(added, link('l1', 'Docs'))
    expect(renamed.links.map((l) => l.title)).toEqual(['Docs', 'Spec'])
  })

  it('removes a link by id', () => {
    expect(removeLink(detail, 'l1').links).toEqual([])
    expect(removeLink(detail, 'nope').links).toEqual(detail.links)
  })
})
