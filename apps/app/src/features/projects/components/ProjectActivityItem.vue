<script setup lang="ts">
import UserAvatar from '@/components/common/UserAvatar.vue'
import GitHubIcon from '@/features/github/components/GitHubIcon.vue'
import { fullDate } from '@/lib/relative-time'
import { activityDay, type ProjectActivityLine } from '../project-activity'

defineProps<{
  line: ProjectActivityLine
  /** Name shown on the avatar; the line's own actor may be null (a milestone completing). */
  avatarName: string
  avatarUrl: string | null
  github: boolean
  at: Date
}>()
</script>

<template>
  <p class="flex items-start gap-2 text-xs leading-5 text-ink-subtle">
    <span class="flex h-5 w-4 shrink-0 items-center justify-center">
      <GitHubIcon v-if="github" class="size-3.5 text-ink-muted" />
      <UserAvatar v-else :name="avatarName" :src="avatarUrl" size="xs" />
    </span>
    <span class="min-w-0">
      <span v-if="line.actor" class="font-medium text-ink-muted">{{ line.actor }}</span>
      {{ line.text }}
      <template v-if="line.issue">
        <span class="font-mono text-ink-muted">{{ line.issue.identifier }}</span>
        {{ line.issue.title }}
      </template>
      <span aria-hidden="true" class="mx-1">·</span>
      <time :datetime="at.toISOString()" :title="fullDate(at)">{{ activityDay(at) }}</time>
    </span>
  </p>
</template>
