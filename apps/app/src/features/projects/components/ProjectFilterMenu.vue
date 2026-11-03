<script setup lang="ts">
import type { ProjectStatus } from '@linear/contract'
import { ListFilter } from '@lucide/vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PROJECT_STATUSES } from '../project-status'

const statuses = defineModel<ProjectStatus[]>({ required: true })

function toggle(value: ProjectStatus, checked: boolean | 'indeterminate') {
  statuses.value = checked
    ? [...statuses.value, value]
    : statuses.value.filter((status) => status !== value)
}
// Keep the menu open so several statuses can be toggled in a row.
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
        <span v-if="statuses.length" class="text-xs text-ink-subtle tabular-nums">
          {{ statuses.length }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52 rounded-lg border-hairline bg-floating p-1.5">
      <DropdownMenuLabel class="px-2.5 text-xs font-normal text-ink-subtle"
        >Status</DropdownMenuLabel
      >
      <DropdownMenuCheckboxItem
        v-for="status in PROJECT_STATUSES"
        :key="status.value"
        :model-value="statuses.includes(status.value)"
        class="h-8 gap-2.5 rounded-md text-[13px]"
        @update:model-value="(checked) => toggle(status.value, checked)"
        @select="keepOpen"
      >
        <StatusIcon :category="status.icon" />
        {{ status.label }}
      </DropdownMenuCheckboxItem>
      <template v-if="statuses.length">
        <DropdownMenuSeparator class="bg-hairline" />
        <DropdownMenuItem class="h-8 rounded-md text-[13px]" @select="statuses = []">
          Clear filter
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
