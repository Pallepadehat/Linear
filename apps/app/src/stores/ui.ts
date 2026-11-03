import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { IssuePrefill } from '@/features/issues/prefill'

export type CreateIssueDefaults = {
  teamId?: string
  statusId?: string
  projectId?: string
  assigneeId?: string
}

/**
 * One breadcrumb segment: plain text, or a link, optionally with the team badge
 * (`teamInitial`) or a mono identifier before the label.
 */
export type Crumb =
  string | { label: string; to?: RouteLocationRaw; teamInitial?: string; identifier?: string }

/** Transient UI state shared across the layout (never server data). */
export const useUiStore = defineStore('ui', () => {
  const createIssueOpen = ref(false)
  /** Preselected in the create issue dialog, e.g. from a team or project page or a group's `+`. */
  const createIssueDefaults = ref<CreateIssueDefaults>({})
  /** Fills the dialog like a template does, e.g. "Make a copy…" with `issuePrefill(issue)`. */
  const createIssuePrefill = ref<IssuePrefill | null>(null)

  function openCreateIssue(
    defaults: CreateIssueDefaults = {},
    prefill: IssuePrefill | null = null,
  ) {
    createIssueDefaults.value = defaults
    createIssuePrefill.value = prefill
    createIssueOpen.value = true
  }

  /** Breadcrumb a page puts in the panel header; null falls back to the route title. */
  const breadcrumb = ref<Crumb[] | null>(null)

  /**
   * Set by the sidebar search button; the issue filter bar focuses its search field and clears it.
   * Stand-in until the command menu (M7-11) takes over search.
   */
  const searchFocusRequested = ref(false)

  return {
    createIssueOpen,
    createIssueDefaults,
    createIssuePrefill,
    openCreateIssue,
    breadcrumb,
    searchFocusRequested,
  }
})
