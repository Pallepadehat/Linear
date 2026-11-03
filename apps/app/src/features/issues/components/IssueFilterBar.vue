<script setup lang="ts">
import type { IssueSort, SortDirection } from '@linear/contract'
import { Search, X } from '@lucide/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { useFilterDimensions } from '../composables/useFilterDimensions'
import { useIssueFilters } from '../composables/useIssueFilters'
import IssueFilterMenu from './IssueFilterMenu.vue'
import IssueSortMenu from './IssueSortMenu.vue'

const props = defineProps<{
  workspaceSlug: string
  teamId?: string
  projectId?: string
  cycleId?: string
  /** The view toolbar above shows the Filter button instead. */
  hideFilterMenu?: boolean
}>()

const SEARCH_DEBOUNCE_MS = 250

const { filters, active, update, clear } = useIssueFilters()
const dimensions = useFilterDimensions(() => props, filters, update)
const activeDimensions = computed(() => dimensions.value.filter((d) => d.active))

const sort = computed({
  get: () => filters.value.sort,
  set: (value: IssueSort) => update({ sort: value }),
})
const showSubIssues = computed({
  get: () => filters.value.showSubIssues,
  set: (value: boolean) => update({ showSubIssues: value }),
})
const direction = computed({
  get: () => filters.value.direction,
  set: (value: SortDirection) => update({ direction: value }),
})

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

function clearSearch(event: KeyboardEvent) {
  if (search.value) search.value = ''
  else (event.target as HTMLInputElement).blur()
}
</script>

<template>
  <div
    class="flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 border-b border-hairline py-2 pr-2 pl-4"
    role="toolbar"
    aria-label="Issue filters"
  >
    <IssueFilterMenu v-if="!hideFilterMenu" :dimensions="dimensions" />
    <div
      v-for="dimension in activeDimensions"
      :key="dimension.key"
      class="flex h-7 items-center overflow-hidden rounded-full border border-hairline text-[13px]"
    >
      <span class="flex items-center gap-1.5 pr-1.5 pl-2.5 text-ink-muted">
        <component :is="dimension.icon" class="size-3.5 text-ink-subtle" aria-hidden="true" />
        {{ dimension.label }}
      </span>
      <button
        v-if="dimension.cycleOperator"
        type="button"
        class="flex h-full items-center border-l border-hairline px-2 text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
        :aria-label="`${dimension.label} ${dimension.operator}, change operator`"
        title="Change operator"
        @click="dimension.cycleOperator()"
      >
        {{ dimension.operator }}
      </button>
      <span v-else class="flex h-full items-center border-l border-hairline px-2 text-ink-subtle">
        {{ dimension.operator }}
      </span>
      <span
        class="max-w-56 truncate border-l border-hairline px-2 text-ink"
        :title="dimension.selectedLabels.join(', ')"
      >
        {{ dimension.summary }}
      </span>
      <button
        type="button"
        class="flex h-full items-center border-l border-hairline px-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        :aria-label="`Remove ${dimension.label} filter`"
        @click="dimension.clear()"
      >
        <X class="size-3.5" aria-hidden="true" />
      </button>
    </div>
    <Button v-if="active" variant="ghost" size="sm" class="text-ink-subtle" @click="clear">
      Clear
    </Button>

    <div class="ml-auto flex items-center gap-1">
      <div
        class="flex h-7 w-52 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2 focus-within:ring-2 focus-within:ring-ring"
      >
        <Search class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          aria-label="Search issues"
          placeholder="Search title or ID..."
          autocomplete="off"
          class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary [&::-webkit-search-cancel-button]:hidden"
          @keydown.esc.prevent="clearSearch"
        />
      </div>
      <IssueSortMenu
        v-model:sort="sort"
        v-model:direction="direction"
        v-model:show-sub-issues="showSubIssues"
      />
    </div>
  </div>
</template>
