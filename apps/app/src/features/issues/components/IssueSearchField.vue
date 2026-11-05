<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { useIssueFilters } from '../composables/useIssueFilters'

/**
 * The "Search title or ID..." field of an issue list or board; it writes `?q=` to the URL.
 * `collapsible`: on phones it starts as an icon button and opens over its toolbar row
 * (the toolbar must be `relative`), staying open while it holds a query.
 */
const props = defineProps<{ collapsible?: boolean }>()

const SEARCH_DEBOUNCE_MS = 250

const { filters, update } = useIssueFilters()
const isMobile = useIsMobile()

// The input updates at once; the URL (and the query) after a pause in typing.
const search = ref(filters.value.q)
const commitSearch = useDebounceFn((value: string) => update({ q: value }), SEARCH_DEBOUNCE_MS)
watch(search, (value) => void commitSearch(value))
// Back/forward or "Clear" change the URL from outside the input.
watch(
  () => filters.value.q,
  (q) => {
    if (q !== search.value.trim()) search.value = q
  },
)

const expanded = ref(false)
const input = useTemplateRef<HTMLInputElement>('input')
const collapsed = () => props.collapsible && isMobile.value && !expanded.value && !search.value

async function expand() {
  expanded.value = true
  await nextTick()
  input.value?.focus()
}
function collapse() {
  search.value = ''
  expanded.value = false
}

function onEscape() {
  if (search.value) search.value = ''
  else if (props.collapsible && isMobile.value) expanded.value = false
  else input.value?.blur()
}
</script>

<template>
  <IconButton v-if="collapsed()" :icon="Search" label="Search issues" @click="expand" />
  <div
    v-else
    class="flex h-7 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2 focus-within:ring-2 focus-within:ring-ring md:w-52"
    :class="
      collapsible && isMobile
        ? 'absolute inset-x-2 top-1/2 z-20 -translate-y-1/2 shadow-floating'
        : 'max-md:min-w-0 max-md:flex-1'
    "
  >
    <Search class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
    <input
      ref="input"
      v-model="search"
      type="search"
      aria-label="Search issues"
      placeholder="Search title or ID..."
      autocomplete="off"
      class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary [&::-webkit-search-cancel-button]:hidden"
      @keydown.esc.prevent="onEscape"
      @blur="!search && (expanded = false)"
    />
    <button
      v-if="search || (collapsible && isMobile)"
      type="button"
      class="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-subtle outline-hidden hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="search ? 'Clear search' : 'Close search'"
      @mousedown.prevent
      @click="collapsible && isMobile ? collapse() : (search = '')"
    >
      <X class="size-3.5" aria-hidden="true" />
    </button>
  </div>
</template>
