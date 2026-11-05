<script setup lang="ts">
import { ListFilter } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePreferencesStore } from '@/stores/preferences'
import { ACTIVITY_FILTERS, ACTIVITY_FILTER_LABELS, isActivityFilter } from '../timeline-folding'

/** The Activity header's menu: what to show, and whether to merge and fold history. */
const preferences = usePreferencesStore()
function setFilter(value: unknown) {
  if (isActivityFilter(value)) preferences.activityFilter = value
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-6 gap-1.5 px-2 text-xs text-ink-subtle data-[state=open]:bg-surface-2"
        aria-label="Activity filter"
      >
        <ListFilter class="size-3.5" aria-hidden="true" />
        {{ ACTIVITY_FILTER_LABELS[preferences.activityFilter] }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuLabel>Show</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        :model-value="preferences.activityFilter"
        @update:model-value="setFilter"
      >
        <DropdownMenuRadioItem v-for="filter in ACTIVITY_FILTERS" :key="filter" :value="filter">
          {{ ACTIVITY_FILTER_LABELS[filter] }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        :model-value="preferences.activityCompact"
        @update:model-value="(value) => (preferences.activityCompact = value === true)"
        @select.prevent
      >
        Compact history
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
