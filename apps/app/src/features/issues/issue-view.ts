import type { StatusCategory } from '@linear/contract'
import type { LocationQuery } from 'vue-router'

/** The pill tabs on a team's and the workspace's issue list (docs/domain.md → Issues). */
export type IssueView = 'all' | 'active' | 'backlog'

export const DEFAULT_ISSUE_VIEW: IssueView = 'all'

// Linear's order: All issues first, then the in-flight and waiting slices.
export const ISSUE_VIEWS: readonly { value: IssueView; label: string }[] = [
  { value: 'all', label: 'All issues' },
  { value: 'active', label: 'Active' },
  { value: 'backlog', label: 'Backlog' },
]

const CATEGORIES: Record<IssueView, StatusCategory[] | undefined> = {
  all: undefined,
  active: ['started', 'unstarted'],
  backlog: ['backlog'],
}

/** The status categories a view lists; `undefined` (All issues) doesn't filter. */
export function viewStatusCategories(view: IssueView | undefined): StatusCategory[] | undefined {
  return view ? CATEGORIES[view] : undefined
}

/** `?view=active|backlog|all`; anything else (or nothing) is All issues. */
export function parseIssueView(query: LocationQuery): IssueView {
  const raw = Array.isArray(query.view) ? query.view[0] : query.view
  return ISSUE_VIEWS.find((v) => v.value === raw)?.value ?? DEFAULT_ISSUE_VIEW
}
