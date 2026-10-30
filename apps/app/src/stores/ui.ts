import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Transient UI state shared across the layout (never server data). */
export const useUiStore = defineStore('ui', () => {
  const createIssueOpen = ref(false)
  /** Team preselected in the create issue dialog, e.g. the team page being viewed. */
  const createIssueTeamId = ref<string | null>(null)

  function openCreateIssue(teamId: string | null = null) {
    createIssueTeamId.value = teamId
    createIssueOpen.value = true
  }

  return { createIssueOpen, createIssueTeamId, openCreateIssue }
})
