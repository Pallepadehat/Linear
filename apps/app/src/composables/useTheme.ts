import { useColorMode } from '@vueuse/core'
import { computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Theme mode persisted in localStorage under "theme" ("auto" = system); the
 * inline script in index.html reads the same key before first paint.
 */
export function useTheme() {
  const colorMode = useColorMode({ storageKey: 'theme', disableTransition: true })

  const mode = computed<ThemeMode>({
    get: () =>
      colorMode.store.value === 'auto'
        ? 'system'
        : colorMode.store.value === 'dark'
          ? 'dark'
          : 'light',
    set: (value) => {
      colorMode.store.value = value === 'system' ? 'auto' : value
    },
  })

  return { mode, resolved: colorMode.state }
}
