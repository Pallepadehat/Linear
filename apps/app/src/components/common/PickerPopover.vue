<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Shared shell for the property pickers: a trigger button opening a filterable,
// keyboard-navigable list. Arrow keys move, Enter selects, Escape closes and
// returns focus to the trigger.
defineProps<{ label: string; placeholder: string }>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="xs" class="justify-start text-ink-muted">
        <span class="sr-only">{{ label }}:</span>
        <slot name="trigger" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-56 rounded-md border-hairline bg-surface-3 p-0 shadow-floating"
    >
      <Command class="bg-transparent">
        <CommandInput :placeholder="placeholder" :aria-label="placeholder" />
        <CommandList class="p-1">
          <CommandEmpty class="py-4 text-ink-subtle">No results</CommandEmpty>
          <CommandGroup class="p-0">
            <slot />
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
