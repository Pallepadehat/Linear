<script setup lang="ts">
import type { IssueSort, SortDirection } from '@linear/contract'
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from '@lucide/vue'
import { computed } from 'vue'
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

const sort = defineModel<IssueSort>('sort', { required: true })
const direction = defineModel<SortDirection>('direction', { required: true })
// Lives here until the display options popover (M7-03) exists.
const showSubIssues = defineModel<boolean>('showSubIssues', { required: true })

const SORTS: { value: IssueSort; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'priority', label: 'Priority' },
]

const sortLabel = computed(() => SORTS.find((s) => s.value === sort.value)?.label ?? 'Created')
// Direction labels in the sort's own terms; No priority stays last either way.
const directions = computed(() =>
  sort.value === 'priority'
    ? [
        { value: 'desc', label: 'Urgent first' },
        { value: 'asc', label: 'Low first' },
      ]
    : [
        { value: 'desc', label: 'Newest first' },
        { value: 'asc', label: 'Oldest first' },
      ],
)

function setSort(value: unknown) {
  const match = SORTS.find((s) => s.value === value)
  if (match) sort.value = match.value
}
function setDirection(value: unknown) {
  if (value === 'asc' || value === 'desc') direction.value = value
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="text-ink-muted data-[state=open]:bg-surface-2">
        <component
          :is="direction === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow"
          aria-hidden="true"
        />
        <span class="sr-only">Order by</span>
        {{ sortLabel }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48 rounded-lg border-hairline bg-floating p-1.5">
      <DropdownMenuLabel class="px-2.5 text-xs font-normal text-ink-subtle"
        >Order by</DropdownMenuLabel
      >
      <DropdownMenuRadioGroup :model-value="sort" @update:model-value="setSort">
        <DropdownMenuRadioItem
          v-for="option in SORTS"
          :key="option.value"
          :value="option.value"
          class="h-8 rounded-md text-[13px]"
        >
          {{ option.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator class="bg-hairline" />
      <DropdownMenuRadioGroup :model-value="direction" @update:model-value="setDirection">
        <DropdownMenuRadioItem
          v-for="option in directions"
          :key="option.value"
          :value="option.value"
          class="h-8 rounded-md text-[13px]"
        >
          {{ option.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator class="bg-hairline" />
      <DropdownMenuCheckboxItem
        :model-value="showSubIssues"
        class="h-8 rounded-md text-[13px]"
        @update:model-value="showSubIssues = $event === true"
        @select.prevent
      >
        Show sub-issues
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
