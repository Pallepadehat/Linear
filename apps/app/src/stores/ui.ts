import type { ProjectStatus } from '@linear/contract'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FavoriteTarget } from '@/features/favorites/favorite-list'
import type { RouteLocationRaw } from 'vue-router'
import type { IssuePrefill } from '@/features/issues/prefill'

export type CreateIssueDefaults = {
  teamId?: string
  statusId?: string
  projectId?: string
  cycleId?: string
  assigneeId?: string
}

/** Enough to name an issue and fetch it; the issue itself stays in the query cache. */
export type IssueRef = { id: string; identifier: string }

/**
 * One breadcrumb segment: plain text, or a link, optionally with the team badge
 * (`teamInitial`), a project icon or a mono identifier before the label.
 */
export type Crumb =
  | string
  | {
      label: string
      to?: RouteLocationRaw
      teamInitial?: string
      identifier?: string
      /** Shows the project icon (or its placeholder glyph) before the label. */
      projectIcon?: { src: string | null }
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
  const breadcrumb = ref<Crumb[] | null>(null)

  /** Projects table filter: the statuses shown (empty = all). */
  const projectStatusFilter = ref<ProjectStatus[]>([])
  const createProjectOpen = ref(false)

  /** ⌘K command menu and the `?` keyboard shortcuts sheet. */
  const commandMenuOpen = ref(false)
  const shortcutsOpen = ref(false)

  /**
   * The issue keyboard actions apply to: the open issue on its page, or the
   * focused row in a list. The command menu's issue actions and ⌘⌫ use it.
   */
  const activeIssue = ref<IssueRef | null>(null)

  /** Issue awaiting the delete confirmation dialog. */
  const issueToDelete = ref<IssueRef | null>(null)

  /** The entity the current page shows, for the header star and ⌥F; reset on navigation. */
  const favoriteTarget = ref<FavoriteTarget | null>(null)

  return {
    createIssueOpen,
    createIssueDefaults,
    createIssuePrefill,
    openCreateIssue,
    breadcrumb,
    projectStatusFilter,
    createProjectOpen,
    commandMenuOpen,
    shortcutsOpen,
    activeIssue,
    issueToDelete,
    favoriteTarget,
  }
})
