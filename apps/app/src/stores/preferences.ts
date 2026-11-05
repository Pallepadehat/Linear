import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'
import {
  parseDisplayOptions,
  type DisplayOptions,
  type DisplayViewKey,
} from '@/features/issues/display-options'
import { isActivityFilter, type ActivityFilter } from '@/features/issues/timeline-folding'
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
  /** Details panel (⌘I) open per view, keyed by `detailsPanelKey()`; closed unless opened. */
  const issueDetails = useLocalStorage<Record<string, boolean>>('issue-details', {})

  /** The project page's right panel (properties, milestones, progress, activity); open by default. */
  const projectPanelOpen = useLocalStorage<boolean>('project-panel-open', true)

  /** The issue page's Activity filter; a malformed stored value reads as "all". */
  const storedActivityFilter = useLocalStorage<unknown>('activity-filter', 'all')
  const activityFilter = computed<ActivityFilter>({
    get: () => (isActivityFilter(storedActivityFilter.value) ? storedActivityFilter.value : 'all'),
    set: (value) => {
      storedActivityFilter.value = value
    },
  })
  /** Merge back-to-back changes and fold long history in the Activity timeline. */
  const activityCompact = useLocalStorage<boolean>('activity-compact', true)

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

  function isDetailsOpen(view: string) {
    return issueDetails.value[view] === true
  }
  function toggleDetails(view: string) {
    const { [view]: open, ...rest } = issueDetails.value
    issueDetails.value = open ? rest : { ...rest, [view]: true }
  }

  return {
    lastWorkspaceSlug,
    sidebarSections,
    isExpanded,
    setExpanded,
    issueDetails,
    isDetailsOpen,
    toggleDetails,
    projectSort,
    projectPanelOpen,
    activityFilter,
    activityCompact,
    displayOptions,
    setDisplayOptions,
    resetDisplayOptions,
  }
})
