import type { InjectionKey } from 'vue'

// Number-key shortcuts (Linear-style "1" = first option) registered by each PickerItem.
export type PickerShortcuts = Map<string, () => void>

export const pickerShortcutsKey: InjectionKey<PickerShortcuts> = Symbol('PickerShortcuts')
