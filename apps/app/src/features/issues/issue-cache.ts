import type {
  BulkUpdateIssuesInput,
  Issue,
  IssueDetail,
  IssueLink,
  IssuePage,
  Label,
  UpdateIssueInput,
} from '@linear/contract'
import type { InfiniteData } from '@tanstack/vue-query'

/**
 * A property change as the UI sees it: full status/label objects, so the
 * optimistic issue renders exactly like the server's response will.
 */
export type IssuePatch = Partial<
  // `parent` only travels with `parentId`, so the detail breadcrumb changes at once.
  Pick<IssueDetail, 'parent'> &
    Pick<
      Issue,
      | 'title'
      | 'description'
      | 'status'
      | 'priority'
      | 'assigneeId'
      | 'projectId'
      | 'milestoneId'
      | 'cycleId'
      | 'labels'
      | 'parentId'
      | 'estimate'
      | 'dueDate'
    >
>

/** The issue as it will look after the patch; `completedAt` follows the category (domain.md). */
export function applyIssuePatch(issue: Issue, patch: IssuePatch, now = new Date()): Issue {
  const next: Issue = { ...issue, ...patch, updatedAt: now }
  // A project change without a milestone clears it, as the server does (domain.md).
  if (
    patch.projectId !== undefined &&
    patch.projectId !== issue.projectId &&
    patch.milestoneId === undefined
  )
    next.milestoneId = null
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

/** Sub-issue progress as the server counts it: canceled sub-issues are left out. */
export function progressOf(children: Pick<Issue, 'status'>[]): Issue['subIssueProgress'] {
  if (children.length === 0) return null
  return {
    done: children.filter((c) => c.status.category === 'completed').length,
    total: children.filter((c) => c.status.category !== 'canceled').length,
  }
}

/**
 * The detail-cache counterpart of `patchIssueInPages`: patches the issue itself
 * (keeping its parent and sub-issues unless the update brings new ones), or one of
 * its sub-issues, recounting the progress.
 */
export function patchIssue<T extends Issue & Partial<Pick<IssueDetail, 'children'>>>(
  data: T | undefined,
  id: string,
  update: (issue: Issue) => Issue,
): T | undefined {
  if (!data) return data
  if (data.id === id) return { ...data, ...update(data) }
  const { children } = data
  if (!children?.some((child) => child.id === id)) return data
  const next = children.map((child) => (child.id === id ? update(child) : child))
  return { ...data, children: next, subIssueProgress: progressOf(next) }
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
    ...(patch.milestoneId !== undefined && { milestoneId: patch.milestoneId }),
    ...(patch.cycleId !== undefined && { cycleId: patch.cycleId }),
    ...(patch.estimate !== undefined && { estimate: patch.estimate }),
    ...(patch.labels && { labelIds: patch.labels.map((label) => label.id) }),
    ...(patch.parentId !== undefined && { parentId: patch.parentId }),
    ...(patch.dueDate !== undefined && { dueDate: patch.dueDate }),
  }
}

/**
 * A bulk action as the UI sees it: the same change for every selected issue, with
 * labels added and removed per issue (docs/domain.md → Bulk actions).
 */
export type BulkIssueChange = Partial<
  Pick<Issue, 'status' | 'priority' | 'assigneeId' | 'projectId'>
> & {
  addLabels?: Label[]
  removeLabelIds?: string[]
}

/** The issue after a bulk change; labels stay sorted by name like the server's. */
export function applyBulkChange(issue: Issue, change: BulkIssueChange, now = new Date()): Issue {
  const { addLabels = [], removeLabelIds = [], ...fields } = change
  const patch: IssuePatch = { ...fields }
  if (addLabels.length || removeLabelIds.length) {
    const removed = new Set(removeLabelIds)
    const byId = new Map([...issue.labels, ...addLabels].map((label) => [label.id, label]))
    patch.labels = [...byId.values()]
      .filter((label) => !removed.has(label.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  return applyIssuePatch(issue, patch, now)
}

export function toBulkUpdateInput(
  workspaceSlug: string,
  ids: string[],
  change: BulkIssueChange,
): BulkUpdateIssuesInput {
  return {
    workspaceSlug,
    ids,
    patch: {
      ...(change.status && { statusId: change.status.id }),
      ...(change.priority !== undefined && { priority: change.priority }),
      ...(change.assigneeId !== undefined && { assigneeId: change.assigneeId }),
      ...(change.projectId !== undefined && { projectId: change.projectId }),
      ...(change.addLabels?.length && { addLabelIds: change.addLabels.map((label) => label.id) }),
      ...(change.removeLabelIds?.length && { removeLabelIds: change.removeLabelIds }),
    },
  }
}

/** The detail without the relation `relationId`, on whichever side it was listed. */
/** The detail with `link` added, or replacing the link with its id. */
export function upsertLink(detail: IssueDetail, link: IssueLink): IssueDetail {
  const exists = detail.links.some((l) => l.id === link.id)
  return {
    ...detail,
    links: exists
      ? detail.links.map((l) => (l.id === link.id ? link : l))
      : [...detail.links, link],
  }
}

export function removeLink(detail: IssueDetail, linkId: string): IssueDetail {
  return { ...detail, links: detail.links.filter((l) => l.id !== linkId) }
}

export function removeRelation(detail: IssueDetail, relationId: string): IssueDetail {
  const without = (list: IssueDetail['relations']['blocks']) =>
    list.filter((related) => related.relationId !== relationId)
  const { blocks, blockedBy, related, duplicateOf, duplicates } = detail.relations
  return {
    ...detail,
    relations: {
      blocks: without(blocks),
      blockedBy: without(blockedBy),
      related: without(related),
      duplicateOf: without(duplicateOf),
      duplicates: without(duplicates),
    },
  }
}
