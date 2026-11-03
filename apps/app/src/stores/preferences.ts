import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import {
  parseDisplayOptions,
  type DisplayOptions,
  type DisplayViewKey,
} from '@/features/issues/display-options'
import {
  DEFAULT_PROJECT_SORT,
  isProjectSort,
  type ProjectSort,
} from '@/features/projects/project-sort'
import { isSectionExpanded, setSectionExpanded } from '@/layouts/sidebar-sections'

/** Per-browser UI preferences (never server data). */
export const usePreferencesStore = defineStore('preferences', () => {
  const lastWorkspaceSlug = useLocalStorage<string | null>('last-workspace', null)
  /**
   * Display options per issue view (layout, grouping, ordering, properties…).
   * Stored as-is and parsed on read, so stale values fall back per field.
   */
  const storedDisplayOptions = useLocalStorage<Record<string, unknown>>('issue-display-options', {})
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

  function isExpanded(key: string) {
    return isSectionExpanded(sidebarSections.value, key)
  }
  function setExpanded(key: string, expanded?: boolean) {
    sidebarSections.value = setSectionExpanded(sidebarSections.value, key, expanded)
  }

  function displayOptions(view: DisplayViewKey): DisplayOptions {
    return parseDisplayOptions(storedDisplayOptions.value[view])
  }
  function setDisplayOptions(view: DisplayViewKey, changes: Partial<DisplayOptions>) {
    storedDisplayOptions.value = {
      ...storedDisplayOptions.value,
      [view]: { ...displayOptions(view), ...changes },
    }
  }
  /** Back to the defaults; the view's entry is dropped. */
  function resetDisplayOptions(view: DisplayViewKey) {
    const { [view]: _, ...rest } = storedDisplayOptions.value
    storedDisplayOptions.value = rest
  }

  return {
    lastWorkspaceSlug,
    sidebarSections,
    isExpanded,
    setExpanded,
    projectSort,
    displayOptions,
    setDisplayOptions,
    resetDisplayOptions,
  }
})
