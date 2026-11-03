<script setup lang="ts">
import { provide, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { useHotkeys } from '@/composables/useHotkeys'
import type { ShortcutId } from '@/lib/hotkeys'
import { cn } from '@/lib/utils'
import { Command, CommandEmpty, CommandGroup, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { pickerShortcutsKey, type PickerShortcuts } from './picker-context'
import PickerInput from './PickerInput.vue'

// Shared shell for the property pickers: a trigger button opening a filterable,
// keyboard-navigable list. Arrow keys move, Enter selects, a number key picks
// that option while the filter is empty, Escape closes and returns focus.
// `current` is the selected option's value, highlighted when the list opens.
// `hotkey` opens the picker from anywhere outside a text field. `compact` pickers
// (one per list row) get an icon-sized trigger and only show the hotkey hint:
// a global key can't tell which of many rows it is meant for.
const props = defineProps<{
  label: string
  placeholder: string
  hotkey?: string
  current?: string
  compact?: boolean
  triggerClass?: string
  align?: 'start' | 'end'
}>()

const PICKER_HOTKEYS: Record<string, ShortcutId> = {
  S: 'issue-status',
  P: 'issue-priority',
  A: 'issue-assignee',
  L: 'issue-labels',
}

const open = defineModel<boolean>('open', { default: false })
const trigger = useTemplateRef<{ $el: HTMLElement }>('trigger')

// The global hotkey goes through the shortcut registry (picker scope), so it
// shows in the `?` sheet; every mounted picker for the key is tried in turn.
const hotkeyId = props.hotkey ? PICKER_HOTKEYS[props.hotkey] : undefined
useHotkeys(
  hotkeyId
    ? [
        {
          id: hotkeyId,
          run: () => {
            if (props.compact || open.value) return false
            const el = trigger.value?.$el
            if (!(el instanceof HTMLElement) || !el.isConnected) return false
            // While a dialog is open, only its own pickers respond (a picker's own
            // popover counts as a dialog too, but then `open` is already true).
            const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]')
            const top = dialogs[dialogs.length - 1]
            if (top ? !top.contains(el) : el.closest('[role="dialog"]')) return false
            open.value = true
          },
        },
      ]
    : [],
)

const shortcuts: PickerShortcuts = new Map()
provide(pickerShortcutsKey, shortcuts)

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const input = event.target
  if (input instanceof HTMLInputElement && input.value !== '') return
  const pick = shortcuts.get(event.key)
  if (!pick) return
  event.preventDefault()
  pick()
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        ref="trigger"
        variant="ghost"
        :aria-keyshortcuts="hotkey"
        size="sm"
        :class="
          cn(
            'rounded-full text-ink data-[state=open]:bg-surface-2',
            compact
              ? 'size-7 justify-center px-0 has-[>svg]:px-0'
              : 'justify-start px-2 has-[>svg]:px-2',
            triggerClass,
          )
        "
      >
        <span class="sr-only">{{ label }}:</span>
        <slot name="trigger" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :align="align ?? 'start'"
      class="w-60 overflow-hidden rounded-lg border-hairline bg-floating p-0 shadow-floating"
    >
      <Command :model-value="current ?? ''" class="bg-transparent" @keydown="onKeydown">
        <PickerInput :placeholder="placeholder" :hotkey="hotkey" />
        <CommandList class="max-h-80 p-1.5" :aria-label="label">
          <CommandEmpty class="py-4 text-ink-subtle">No results</CommandEmpty>
          <CommandGroup class="p-0">
            <slot />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
