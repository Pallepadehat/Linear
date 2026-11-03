<script setup lang="ts">
import { Box } from '@lucide/vue'
import PriorityIcon from '@/components/common/PriorityIcon.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UnassignedIcon from '@/components/common/UnassignedIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import type { GroupIcon } from '../group-issues'

// The icon before a group header or board column name, per grouping.
defineProps<{ icon: GroupIcon }>()
</script>

<template>
  <StatusIcon v-if="icon.type === 'status'" :category="icon.category" />
  <PriorityIcon v-else-if="icon.type === 'priority'" :priority="icon.priority" class="size-3.5" />
  <UserAvatar v-else-if="icon.type === 'user'" :name="icon.name" :src="icon.avatarUrl" size="xs" />
  <UnassignedIcon v-else-if="icon.type === 'unassigned'" class="size-3.5 text-ink-tertiary" />
  <ProjectIcon v-else-if="icon.type === 'project'" :src="icon.iconUrl" />
  <!-- The label's own color is user data, not a design token. -->
  <span
    v-else-if="icon.type === 'label'"
    class="flex size-3.5 shrink-0 items-center justify-center"
    aria-hidden="true"
  >
    <span class="size-2 rounded-full" :style="{ backgroundColor: icon.color }" />
  </span>
  <Box v-else class="size-3.5 shrink-0 text-ink-tertiary" aria-hidden="true" />
</template>
