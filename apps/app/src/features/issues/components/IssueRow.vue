<script setup lang="ts">
import type { Issue } from '@linear/contract'
import PriorityIcon from '@/components/common/PriorityIcon.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UnassignedIcon from '@/components/common/UnassignedIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { priorityLabel, toPriority } from '@/lib/priorities'

defineProps<{ issue: Issue; assignee?: { name: string; avatarUrl: string | null } }>()

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
</script>

<template>
  <div class="mx-2 flex h-full items-center gap-2.5 rounded-md pr-3 pl-6 hover:bg-surface-2">
    <PriorityIcon :priority="toPriority(issue.priority)" />
    <span class="sr-only">Priority: {{ priorityLabel(toPriority(issue.priority)) }}</span>
    <span class="w-[4.5rem] shrink-0 truncate font-mono text-[13px] text-ink-subtle">
      {{ issue.identifier }}
    </span>
    <StatusIcon :category="issue.status.category" />
    <span class="sr-only">Status: {{ issue.status.name }}</span>
    <span class="min-w-0 flex-1 truncate font-medium text-ink">{{ issue.title }}</span>
    <ul v-if="issue.labels.length" class="hidden shrink-0 items-center gap-1 md:flex">
      <li
        v-for="label in issue.labels"
        :key="label.id"
        class="flex h-6 max-w-32 items-center gap-1.5 rounded-full border border-hairline px-2 text-xs text-ink-muted"
      >
        <!-- The label's own color is user data, not a design token. -->
        <span
          class="size-2 shrink-0 rounded-full"
          :style="{ backgroundColor: label.color }"
          aria-hidden="true"
        />
        <span class="truncate">{{ label.name }}</span>
      </li>
    </ul>
    <span class="flex w-6 shrink-0 justify-center">
      <UserAvatar v-if="assignee" :name="assignee.name" :src="assignee.avatarUrl" size="sm" />
      <UnassignedIcon v-else />
    </span>
    <span class="sr-only">Assignee: {{ assignee?.name ?? 'Unassigned' }}</span>
    <time
      :datetime="issue.createdAt.toISOString()"
      class="hidden w-14 shrink-0 text-right text-[13px] text-ink-subtle tabular-nums sm:block"
    >
      {{ dateFormat.format(issue.createdAt) }}
    </time>
  </div>
</template>
