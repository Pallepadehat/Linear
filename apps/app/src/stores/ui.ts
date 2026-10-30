import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Transient UI state shared across the layout (never server data). */
export const useUiStore = defineStore('ui', () => {
  const createIssueOpen = ref(false)
  /** Preselected in the create issue dialog, e.g. from a team page or a group's `+`. */
  const createIssueDefaults = ref<{ teamId?: string; statusId?: string }>({})

  function openCreateIssue(defaults: { teamId?: string; statusId?: string } = {}) {
    createIssueDefaults.value = defaults
    createIssueOpen.value = true
  }

  /** Breadcrumb a page puts in the panel header; null falls back to the route title. */
  const breadcrumb = ref<string[] | null>(null)

  return { createIssueOpen, createIssueDefaults, openCreateIssue, breadcrumb }
})
