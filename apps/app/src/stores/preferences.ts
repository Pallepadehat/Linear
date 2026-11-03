import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export type IssueLayout = 'list' | 'board'

/** Per-browser UI preferences (never server data). */
export const usePreferencesStore = defineStore('preferences', () => {
  const lastWorkspaceSlug = useLocalStorage<string | null>('last-workspace', null)
  /** List or board on the team and all-issues pages. */
  const issueLayout = useLocalStorage<IssueLayout>('issue-layout', 'list')
  return { lastWorkspaceSlug, issueLayout }
})
