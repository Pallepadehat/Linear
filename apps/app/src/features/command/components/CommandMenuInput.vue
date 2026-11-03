<script setup lang="ts">
import { injectListboxRootContext, ListboxFilter } from 'reka-ui'
import { nextTick, watch } from 'vue'
import { useCommand } from '@/components/ui/command'

// The menu's filter field. Lives inside `Command` so it can share its filter
// state, and reports the term up for the server-side issue search.
const props = defineProps<{
  placeholder: string
  context?: string
  /** Changes when async results (issue search) arrive, to re-highlight the first row. */
  resultsKey?: string
}>()
const search = defineModel<string>('search', { required: true })
const emit = defineEmits<{ back: [] }>()

const { filterState } = useCommand()
watch(
  () => filterState.search,
  (value) => (search.value = value),
  { immediate: true },
)

// Server results land after typing highlighted the first row; highlight again.
const listbox = injectListboxRootContext()
watch(
  () => props.resultsKey,
  async () => {
    await nextTick()
    listbox.highlightFirstItem()
  },
)

function onKeydown(event: KeyboardEvent) {
  // Backspace on an empty field leaves a sub page, like Linear.
  if (event.key === 'Backspace' && filterState.search === '') emit('back')
}
</script>

<template>
  <div class="grid gap-2 border-b border-hairline px-4 pt-3 pb-2">
    <span
      v-if="context"
      class="inline-flex h-6 max-w-full items-center self-start truncate rounded-xs bg-surface-2 px-2 text-xs text-ink-muted"
    >
      {{ context }}
    </span>
    <ListboxFilter
      v-model="filterState.search"
      auto-focus
      :placeholder="placeholder"
      :aria-label="placeholder"
      class="h-9 w-full bg-transparent text-[15px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
      @keydown="onKeydown"
    />
  </div>
</template>
