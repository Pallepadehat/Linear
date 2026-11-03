import type { Issue, IssuePage, UpdateIssueInput } from '@linear/contract'
import type { InfiniteData } from '@tanstack/vue-query'

/**
 * A property change as the UI sees it: full status/label objects, so the
 * optimistic issue renders exactly like the server's response will.
 */
export type IssuePatch = Partial<
  Pick<
    Issue,
    'title' | 'description' | 'status' | 'priority' | 'assigneeId' | 'projectId' | 'labels'
  >
>

/** The issue as it will look after the patch; `completedAt` follows the category (domain.md). */
export function applyIssuePatch(issue: Issue, patch: IssuePatch, now = new Date()): Issue {
  const next: Issue = { ...issue, ...patch, updatedAt: now }
  if (patch.status) {
    const wasCompleted = issue.status.category === 'completed'
    const isCompleted = patch.status.category === 'completed'
    if (isCompleted && !wasCompleted) next.completedAt = now
    if (!isCompleted) next.completedAt = null
  }
  return next
}

/**
 * Replaces the issue with `id` in an infinite list cache. Returns the same
 * object when the issue isn't loaded there, so untouched lists don't re-render.
 */
export function patchIssueInPages(
  data: InfiniteData<IssuePage> | undefined,
  id: string,
  update: (issue: Issue) => Issue,
): InfiniteData<IssuePage> | undefined {
  if (!data) return data
  let changed = false
  const pages = data.pages.map((page) => {
    const index = page.items.findIndex((item) => item.id === id)
    const current = page.items[index]
    if (!current) return page
    changed = true
    const items = page.items.slice()
    items[index] = update(current)
    return { ...page, items }
  })
  return changed ? { ...data, pages } : data
}

/** Drops the issue with `id` from an infinite list cache (same object when absent). */
export function removeIssueFromPages(
  data: InfiniteData<IssuePage> | undefined,
  id: string,
): InfiniteData<IssuePage> | undefined {
  if (!data?.pages.some((page) => page.items.some((item) => item.id === id))) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== id),
    })),
  }
}

/** The detail-cache counterpart of `patchIssueInPages`. */
export function patchIssue(
  data: Issue | undefined,
  id: string,
  update: (issue: Issue) => Issue,
): Issue | undefined {
  return data?.id === id ? update(data) : data
}

export function toUpdateIssueInput(
  workspaceSlug: string,
  id: string,
  patch: IssuePatch,
): UpdateIssueInput {
  return {
    workspaceSlug,
    id,
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.status && { statusId: patch.status.id }),
    ...(patch.priority !== undefined && { priority: patch.priority }),
    ...(patch.assigneeId !== undefined && { assigneeId: patch.assigneeId }),
    ...(patch.projectId !== undefined && { projectId: patch.projectId }),
    ...(patch.labels && { labelIds: patch.labels.map((label) => label.id) }),
  }
}
