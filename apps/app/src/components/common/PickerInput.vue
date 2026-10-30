<script setup lang="ts">
import { ListboxFilter } from 'reka-ui'
import { useCommand } from '@/components/ui/command'

defineProps<{ placeholder: string; hotkey?: string }>()

const { filterState } = useCommand()
</script>

<template>
  <div class="flex h-10 items-center gap-2 border-b border-hairline px-3.5">
    <ListboxFilter
      v-model="filterState.search"
      auto-focus
      :placeholder="placeholder"
      :aria-label="placeholder"
      class="h-full w-full bg-transparent text-sm text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
    />
    <kbd
      v-if="hotkey"
      class="inline-flex size-5 shrink-0 items-center justify-center rounded-xs border border-hairline-strong font-sans text-xs text-ink-subtle"
      aria-hidden="true"
    >
      {{ hotkey }}
    </kbd>
  </div>
</template>
