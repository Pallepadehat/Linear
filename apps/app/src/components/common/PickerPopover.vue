<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, provide, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Command, CommandEmpty, CommandGroup, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { pickerShortcutsKey, type PickerShortcuts } from './picker-context'
import PickerInput from './PickerInput.vue'

// Shared shell for the property pickers: a trigger button opening a filterable,
// keyboard-navigable list. Arrow keys move, Enter selects, a number key picks
// that option while the filter is empty, Escape closes and returns focus.
// `current` is the selected option's value, highlighted when the list opens.
// `hotkey` opens the picker from anywhere outside a text field (`shift` makes it
// ⇧+key). Inside a `[data-hotkey-scope]` (a list row) it only fires while focus is
// in that scope, since a global key can't tell which of many rows it is meant for;
// other `compact` pickers (icon-sized triggers) only show the hint. `hiddenTrigger`
// keeps an invisible anchor so the hotkey still opens a picker with nothing to show.
// A `panel` slot replaces the option list (e.g. a calendar). `multiple` pickers
// (labels) toggle the highlighted row with Space too while the filter is empty,
// and render their own empty state (it shares space with "Create new label").
const props = defineProps<{
  label: string
  placeholder: string
  hotkey?: string
  shift?: boolean
  current?: string
  compact?: boolean
  hiddenTrigger?: boolean
  triggerClass?: string
  align?: 'start' | 'end'
  multiple?: boolean
}>()

const hotkeyHint = computed(() => (props.hotkey && props.shift ? `⇧${props.hotkey}` : props.hotkey))
const ariaHotkey = computed(() =>
  props.hotkey && props.shift ? `Shift+${props.hotkey}` : props.hotkey,
)

const open = defineModel<boolean>('open', { default: false })
const trigger = useTemplateRef<{ $el: HTMLElement }>('trigger')

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!props.hotkey || open.value || event.defaultPrevented) return
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey !== !!props.shift) return
  if (event.key.toUpperCase() !== props.hotkey) return
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select'))
  )
    return
  const el = trigger.value?.$el
  if (!(el instanceof HTMLElement) || !el.isConnected) return
  const scope = el.closest('[data-hotkey-scope]')
  if (scope ? !scope.contains(document.activeElement) : props.compact) return
  // While a dialog is open, only its own pickers respond.
  const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]')
  const top = dialogs[dialogs.length - 1]
  if (top ? !top.contains(el) : el.closest('[role="dialog"]')) return
  event.preventDefault()
  open.value = true
})

const shortcuts: PickerShortcuts = new Map()
provide(pickerShortcutsKey, shortcuts)

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const input = event.target
  if (input instanceof HTMLInputElement && input.value !== '') return
  if (event.key === ' ' && props.multiple && event.currentTarget instanceof HTMLElement) {
    const row = event.currentTarget.querySelector<HTMLElement>('[data-highlighted]')
    if (!row) return
    event.preventDefault()
    row.click()
    return
  }
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
        :aria-keyshortcuts="ariaHotkey"
        size="sm"
        :tabindex="hiddenTrigger ? -1 : undefined"
        :aria-hidden="hiddenTrigger || undefined"
        :class="
          cn(
            'rounded-full text-ink data-[state=open]:bg-surface-2',
            compact
              ? 'size-7 justify-center px-0 has-[>svg]:px-0'
              : 'justify-start px-2 has-[>svg]:px-2',
            triggerClass,
            hiddenTrigger &&
              'pointer-events-none w-0 overflow-hidden border-0 p-0 opacity-0 has-[>svg]:px-0',
          )
        "
      >
        <span class="sr-only">{{ label }}:</span>
        <slot name="trigger" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :align="align ?? 'start'"
      :class="$slots.panel ? 'w-auto' : 'w-60'"
      class="overflow-hidden rounded-lg border-hairline bg-floating p-0 shadow-floating"
    >
      <slot v-if="$slots.panel" name="panel" />
      <Command v-else :model-value="current ?? ''" class="bg-transparent" @keydown="onKeydown">
        <PickerInput :placeholder="placeholder" :hotkey="hotkeyHint" />
        <CommandList class="max-h-80 p-1.5" :aria-label="label">
          <CommandEmpty v-if="!multiple" class="py-4 text-ink-subtle">No results</CommandEmpty>
          <!-- Pickers with sections (assignee: you, then team members) supply their own groups. -->
          <slot name="groups">
            <CommandGroup class="p-0">
              <slot />
            </CommandGroup>
          </slot>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
