import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export type CreateIssueDefaults = {
  teamId?: string
  statusId?: string
  projectId?: string
  assigneeId?: string
  /** Prefilled content, e.g. from an issue's "Make a copy…". */
  title?: string
  description?: string
  priority?: number
  labelIds?: string[]
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

  function openCreateIssue(defaults: CreateIssueDefaults = {}) {
    createIssueDefaults.value = defaults
    createIssueOpen.value = true
  }

  /** Breadcrumb a page puts in the panel header; null falls back to the route title. */
  const breadcrumb = ref<Crumb[] | null>(null)

  return { createIssueOpen, createIssueDefaults, openCreateIssue, breadcrumb }
})
