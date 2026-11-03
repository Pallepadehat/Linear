<script setup lang="ts">
import type { Notification } from '@linear/contract'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import GitHubIcon from '@/features/github/components/GitHubIcon.vue'
import { fullDate, shortTimeAgo } from '@/lib/relative-time'

defineProps<{ notification: Notification; selected: boolean }>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    :aria-current="selected || undefined"
    class="flex h-14 w-full min-w-0 items-center gap-3 rounded-md px-3 text-left outline-hidden hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
    :class="selected && 'bg-surface-3 hover:bg-surface-3'"
    @click="$emit('select')"
  >
    <span class="flex size-5 shrink-0 items-center justify-center">
      <GitHubIcon v-if="notification.actor.type === 'github'" class="size-4 text-ink-muted" />
      <UserAvatar
        v-else
        :name="notification.actor.name ?? 'Someone'"
        :src="notification.actor.avatarUrl"
        size="sm"
      />
    </span>
    <span class="grid min-w-0 flex-1 gap-0.5">
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="shrink-0 font-mono text-xs text-ink-subtle">
          {{ notification.issue.identifier }}
        </span>
        <span
          class="truncate"
          :class="notification.readAt ? 'text-ink-muted' : 'font-medium text-ink'"
        >
          {{ notification.issue.title }}
        </span>
      </span>
      <span class="flex min-w-0 items-center gap-1.5 text-xs text-ink-subtle">
        <StatusIcon :category="notification.issue.status.category" class="size-3" />
        <span class="truncate">{{ notification.summary }}</span>
      </span>
    </span>
    <span class="flex shrink-0 flex-col items-end gap-1.5">
      <time
        :datetime="notification.createdAt.toISOString()"
        :title="fullDate(notification.createdAt)"
        class="text-xs text-ink-subtle tabular-nums"
      >
        {{ shortTimeAgo(notification.createdAt) }}
      </time>
      <span
        class="size-2 rounded-full"
        :class="notification.readAt ? 'bg-transparent' : 'bg-primary'"
        aria-hidden="true"
      />
      <span v-if="!notification.readAt" class="sr-only">Unread</span>
    </span>
  </button>
</template>
