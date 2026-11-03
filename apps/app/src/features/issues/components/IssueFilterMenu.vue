<script setup lang="ts">
import { ListFilter } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FilterDimension } from '../composables/useFilterDimensions'

defineProps<{ dimensions: FilterDimension[] }>()

// Keep the submenu open so several values can be toggled in a row.
function keepOpen(event: Event) {
  event.preventDefault()
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="text-ink-muted data-[state=open]:bg-surface-2">
        <ListFilter aria-hidden="true" />
        Filter
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-52 rounded-lg border-hairline bg-floating p-1.5">
      <DropdownMenuSub v-for="dimension in dimensions" :key="dimension.key">
        <DropdownMenuSubTrigger class="h-8 gap-2.5 rounded-md px-2.5 text-[13px]">
          <component :is="dimension.icon" class="size-4 text-ink-subtle" aria-hidden="true" />
          {{ dimension.label }}
          <span
            v-if="dimension.selectedLabels.length"
            class="ml-auto text-xs text-ink-subtle tabular-nums"
          >
            {{ dimension.selectedLabels.length }}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent class="max-h-80 w-56 rounded-lg border-hairline bg-floating p-1.5">
          <p v-if="dimension.options.length === 0" class="px-2.5 py-2 text-ink-subtle">
            No options
          </p>
          <DropdownMenuCheckboxItem
            v-for="option in dimension.options"
            :key="option.key"
            :model-value="option.selected"
            class="h-8 gap-2.5 rounded-md text-[13px]"
            @update:model-value="option.toggle()"
            @select="keepOpen"
          >
            <component :is="option.icon" />
            <span class="truncate">{{ option.label }}</span>
          </DropdownMenuCheckboxItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
