<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { provide, useTemplateRef } from 'vue'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { pickerShortcutsKey, type PickerShortcuts } from './picker-context'
import PickerInput from './PickerInput.vue'

// Shared shell for the property pickers: a trigger button opening a filterable,
// keyboard-navigable list. Arrow keys move, Enter selects, a number key picks
// that option while the filter is empty, Escape closes and returns focus.
// `current` is the selected option's value, highlighted when the list opens.
// `hotkey` opens the picker from anywhere outside a text field.
const props = defineProps<{
  label: string
  placeholder: string
  hotkey?: string
  current?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const trigger = useTemplateRef<{ $el: HTMLElement }>('trigger')

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!props.hotkey || open.value || event.defaultPrevented) return
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
  if (event.key.toUpperCase() !== props.hotkey) return
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select'))
  )
    return
  const el = trigger.value?.$el
  if (!(el instanceof HTMLElement) || !el.isConnected) return
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
        class="justify-start rounded-full px-2 text-ink has-[>svg]:px-2 data-[state=open]:bg-surface-2"
      >
        <span class="sr-only">{{ label }}:</span>
        <slot name="trigger" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-60 overflow-hidden rounded-lg border-hairline bg-floating p-0 shadow-floating"
    >
      <Command :model-value="current ?? ''" class="bg-transparent" @keydown="onKeydown">
        <PickerInput :placeholder="placeholder" :hotkey="hotkey" />
        <CommandList class="max-h-80 p-1.5">
          <CommandEmpty class="py-4 text-ink-subtle">No results</CommandEmpty>
          <CommandGroup class="p-0">
            <slot />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
