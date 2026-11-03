import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import {
  isDefaultDisplayOptions,
  type DisplayOptions,
  type DisplayViewKey,
} from '../display-options'

/**
 * A view's display options from the preferences store (per view key, kept across
 * reloads). The toolbar popover and the list / board read the same entry.
 */
export function useDisplayOptions(view: MaybeRefOrGetter<DisplayViewKey>) {
  const preferences = usePreferencesStore()
  const options = computed(() => preferences.displayOptions(toValue(view)))

  return {
    options,
    isDefault: computed(() => isDefaultDisplayOptions(options.value)),
    update: (changes: Partial<DisplayOptions>) =>
      preferences.setDisplayOptions(toValue(view), changes),
    reset: () => preferences.resetDisplayOptions(toValue(view)),
  }
}
