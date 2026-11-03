import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { IssuePrefill } from '@/features/issues/prefill'

export type CreateIssueDefaults = {
  teamId?: string
  statusId?: string
  projectId?: string
  assigneeId?: string
}

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
  const breadcrumb = ref<string[] | null>(null)

  return {
    createIssueOpen,
    createIssueDefaults,
    createIssuePrefill,
    openCreateIssue,
    breadcrumb,
  }
})
