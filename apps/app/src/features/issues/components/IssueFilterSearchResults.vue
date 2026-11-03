<script setup lang="ts">
import { ListboxGroup, ListboxGroupLabel, ListboxItem, useFilter } from 'reka-ui'
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import { useCommand } from '@/components/ui/command'
import type { FilterDimension, FilterOption } from '../composables/useFilterDimensions'

// The root page's value matches ("Status › Todo"): only while something is typed, so
// the untouched menu lists just the dimensions, like Linear's "Add Filter…".
// `entries`: the root page's own rows (dimension names), for the empty state.
const props = defineProps<{ dimensions: FilterDimension[]; entries: string[] }>()
const emit = defineEmits<{ pick: [dimension: FilterDimension, option: FilterOption] }>()

const { filterState } = useCommand()
// Matches are computed here too: items mounted after the search changed would
// otherwise show unfiltered until the next keystroke. Same text as the item's own.
const { contains } = useFilter({ sensitivity: 'base' })
// Date presets ("Past week") and text dimensions are only reachable through their page.
const matches = computed(() => {
  const search = filterState.search
  if (!search) return []
  return props.dimensions
    .filter((d) => !d.date && !d.text)
    .map((dimension) => ({
      dimension,
      options: dimension.options.filter((o) => contains(`${dimension.label}:${o.label}`, search)),
    }))
    .filter((group) => group.options.length)
})
const empty = computed(
  () =>
    !!filterState.search &&
    !matches.value.length &&
    !props.entries.some((entry) => contains(entry, filterState.search)),
)
</script>

<template>
  <p v-if="empty" class="py-4 text-center text-ink-subtle">No results</p>
  <!-- Plain listbox parts: Command's own filter hides rows mounted after the search ran. -->
  <ListboxGroup v-for="{ dimension, options } in matches" :key="dimension.key">
    <ListboxGroupLabel class="px-2.5 pt-2 pb-1 text-xs font-medium text-ink-subtle">
      {{ dimension.label }}
    </ListboxGroupLabel>
    <ListboxItem
      v-for="option in options"
      :key="`${dimension.key}:${option.key}`"
      :value="`${dimension.key}:${option.key}`"
      class="flex h-8 cursor-default items-center gap-2.5 rounded-md px-2.5 text-[13px] text-ink outline-hidden select-none data-[highlighted]:bg-floating-hover"
      @select="emit('pick', dimension, option)"
    >
      <component :is="option.icon" class="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      <span class="sr-only">{{ dimension.label }}:</span>
      <span class="truncate">{{ option.label }}</span>
      <Check v-if="option.selected" class="ml-auto size-4 shrink-0 text-ink" aria-hidden="true" />
    </ListboxItem>
  </ListboxGroup>
</template>
