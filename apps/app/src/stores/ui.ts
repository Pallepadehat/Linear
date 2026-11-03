import type { ProjectStatus } from '@linear/contract'
import { defineStore } from 'pinia'
import { ref } from 'vue'

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

  function openCreateIssue(defaults: CreateIssueDefaults = {}) {
    createIssueDefaults.value = defaults
    createIssueOpen.value = true
  }

  /** Breadcrumb a page puts in the panel header; null falls back to the route title. */
  const breadcrumb = ref<string[] | null>(null)

  /** Projects table filter: the statuses shown (empty = all). */
  const projectStatusFilter = ref<ProjectStatus[]>([])

  return { createIssueOpen, createIssueDefaults, openCreateIssue, breadcrumb, projectStatusFilter }
})
