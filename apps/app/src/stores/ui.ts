import { defineStore } from 'pinia'
import { ref } from 'vue'

export type CreateIssueDefaults = {
  teamId?: string
  statusId?: string
  projectId?: string
  assigneeId?: string
}

/** Enough to name an issue and fetch it; the issue itself stays in the query cache. */
export type IssueRef = { id: string; identifier: string }

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

  return {
    createIssueOpen,
    createIssueDefaults,
    openCreateIssue,
    breadcrumb,
    createProjectOpen,
    commandMenuOpen,
    shortcutsOpen,
    activeIssue,
    issueToDelete,
  }
})
