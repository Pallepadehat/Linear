import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import {
  DEFAULT_PROJECT_SORT,
  isProjectSort,
  type ProjectSort,
} from '@/features/projects/project-sort'
import { isSectionExpanded, setSectionExpanded } from '@/layouts/sidebar-sections'

export type IssueLayout = 'list' | 'board'

/** Per-browser UI preferences (never server data). */
export const usePreferencesStore = defineStore('preferences', () => {
  const lastWorkspaceSlug = useLocalStorage<string | null>('last-workspace', null)
  /** List or board on the team and all-issues pages. */
  const issueLayout = useLocalStorage<IssueLayout>('issue-layout', 'list')
  /** Column the projects table is sorted by; a malformed stored value reads as the default. */
  const storedProjectSort = useLocalStorage<unknown>('project-sort', DEFAULT_PROJECT_SORT)
  const projectSort = computed<ProjectSort>({
    get: () =>
      isProjectSort(storedProjectSort.value) ? storedProjectSort.value : DEFAULT_PROJECT_SORT,
    set: (value) => {
      storedProjectSort.value = value
    },
  })
  /** Expanded/collapsed sidebar sections and team rows; survives reloads. */
  const sidebarSections = useLocalStorage<Record<string, boolean>>('sidebar-sections', {})
  /** Details panel (⌘I) open per view, keyed by `detailsPanelKey()`; closed unless opened. */
  const issueDetails = useLocalStorage<Record<string, boolean>>('issue-details', {})

  function isExpanded(key: string) {
    return isSectionExpanded(sidebarSections.value, key)
  }
  function setExpanded(key: string, expanded?: boolean) {
    sidebarSections.value = setSectionExpanded(sidebarSections.value, key, expanded)
  }

  function isDetailsOpen(view: string) {
    return issueDetails.value[view] === true
  }
  function toggleDetails(view: string) {
    const { [view]: open, ...rest } = issueDetails.value
    issueDetails.value = open ? rest : { ...rest, [view]: true }
  }

  return {
    lastWorkspaceSlug,
    issueLayout,
    sidebarSections,
    isExpanded,
    setExpanded,
    issueDetails,
    isDetailsOpen,
    toggleDetails,
    projectSort,
  }
})
