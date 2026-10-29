import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

/** Per-browser UI preferences (never server data). */
export const usePreferencesStore = defineStore('preferences', () => {
  const lastWorkspaceSlug = useLocalStorage<string | null>('last-workspace', null)
  return { lastWorkspaceSlug }
})
