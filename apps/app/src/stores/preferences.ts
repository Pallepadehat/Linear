import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { isSectionExpanded, setSectionExpanded } from '@/layouts/sidebar-sections'

export type IssueLayout = 'list' | 'board'

/** Per-browser UI preferences (never server data). */
export const usePreferencesStore = defineStore('preferences', () => {
  const lastWorkspaceSlug = useLocalStorage<string | null>('last-workspace', null)
  /** List or board on the team and all-issues pages. */
  const issueLayout = useLocalStorage<IssueLayout>('issue-layout', 'list')
  /** Expanded/collapsed sidebar sections and team rows; survives reloads. */
  const sidebarSections = useLocalStorage<Record<string, boolean>>('sidebar-sections', {})

  function isExpanded(key: string) {
    return isSectionExpanded(sidebarSections.value, key)
  }
  function setExpanded(key: string, expanded?: boolean) {
    sidebarSections.value = setSectionExpanded(sidebarSections.value, key, expanded)
  }

  return { lastWorkspaceSlug, issueLayout, sidebarSections, isExpanded, setExpanded }
})
