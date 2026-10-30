<script setup lang="ts">
import type { Issue } from '@linear/contract'
import PriorityIcon from '@/components/common/PriorityIcon.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { priorityLabel, toPriority } from '@/lib/priorities'

defineProps<{ issue: Issue; assignee?: { name: string; avatarUrl: string | null } }>()
</script>

<template>
  <div class="flex h-10 items-center gap-3 border-b border-hairline px-6 hover:bg-surface-1">
    <PriorityIcon :priority="toPriority(issue.priority)" />
    <span class="sr-only">{{ priorityLabel(toPriority(issue.priority)) }}</span>
    <span class="w-16 shrink-0 truncate font-mono text-[13px] text-ink-subtle">
      {{ issue.identifier }}
    </span>
    <StatusIcon :category="issue.status.category" />
    <span class="sr-only">{{ issue.status.name }}</span>
    <span class="min-w-0 flex-1 truncate text-ink">{{ issue.title }}</span>
    <ul v-if="issue.labels.length" class="hidden shrink-0 items-center gap-1 sm:flex">
      <li
        v-for="label in issue.labels"
        :key="label.id"
        class="flex h-6 items-center gap-1.5 rounded-full border border-hairline px-2 text-xs text-ink-muted"
      >
        <!-- The label's own color is user data, not a design token. -->
        <span
          class="size-2 rounded-full"
          :style="{ backgroundColor: label.color }"
          aria-hidden="true"
        />
        {{ label.name }}
      </li>
    </ul>
    <UserAvatar v-if="assignee" :name="assignee.name" :src="assignee.avatarUrl" size="sm" />
    <span v-else class="size-5 shrink-0" aria-hidden="true" />
  </div>
</template>
