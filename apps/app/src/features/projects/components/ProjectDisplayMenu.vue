<script setup lang="ts">
import { SlidersHorizontal } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PROJECT_SORT_KEYS, type ProjectSort } from '../project-sort'
import { PROJECT_COLUMN_LABELS } from '../project-columns'

const sort = defineModel<ProjectSort>({ required: true })

function setKey(value: unknown) {
  const key = PROJECT_SORT_KEYS.find((k) => k === value)
  if (key) sort.value = { ...sort.value, key }
}
function setDirection(value: unknown) {
  if (value === 'asc' || value === 'desc') sort.value = { ...sort.value, direction: value }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Display options"
        class="text-ink-muted data-[state=open]:bg-surface-2"
      >
        <SlidersHorizontal aria-hidden="true" />
        Display
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48">
      <DropdownMenuLabel class="px-2.5 font-normal"> Order by </DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="sort.key" @update:model-value="setKey">
        <DropdownMenuRadioItem v-for="key in PROJECT_SORT_KEYS" :key="key" :value="key">
          {{ PROJECT_COLUMN_LABELS[key] }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup :model-value="sort.direction" @update:model-value="setDirection">
        <DropdownMenuRadioItem value="asc"> Ascending </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="desc"> Descending </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
