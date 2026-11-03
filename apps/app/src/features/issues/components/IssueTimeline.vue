<script setup lang="ts">
import { GitPullRequest } from '@lucide/vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { fullDate, timeAgo } from '@/lib/relative-time'
import {
  activityActor,
  describeActivity,
  type ActivityNames,
  type TimelineEntry,
} from '../issue-timeline'

defineProps<{
  entries: TimelineEntry[]
  names: ActivityNames
  avatarOf: (userId: string) => string | null
}>()
</script>

<template>
  <ol class="grid gap-3">
    <li v-for="entry in entries" :key="entry.key">
      <article
        v-if="entry.type === 'comment'"
        class="rounded-lg border border-hairline bg-surface-1 px-4 py-3"
      >
        <header class="flex items-center gap-2 text-[13px]">
          <UserAvatar
            :name="entry.comment.author.name"
            :src="entry.comment.author.avatarUrl"
            size="sm"
          />
          <span class="font-medium text-ink">{{ entry.comment.author.name }}</span>
          <time
            :datetime="entry.at.toISOString()"
            :title="fullDate(entry.at)"
            class="text-xs text-ink-subtle"
          >
            {{ timeAgo(entry.at) }}
          </time>
          <span
            v-if="entry.comment.updatedAt.getTime() !== entry.comment.createdAt.getTime()"
            class="text-xs text-ink-subtle"
            :title="fullDate(entry.comment.updatedAt)"
          >
            (edited)
          </span>
        </header>
        <p class="mt-2 text-sm break-words whitespace-pre-wrap text-ink">
          {{ entry.comment.body }}
        </p>
      </article>
      <p v-else class="flex items-center gap-2 pl-4 text-xs text-ink-subtle">
        <span class="flex size-4 shrink-0 items-center justify-center">
          <GitPullRequest
            v-if="entry.activity.actorType === 'github'"
            class="size-3.5 text-ink-muted"
            aria-hidden="true"
          />
          <UserAvatar
            v-else
            :name="activityActor(entry.activity, names)"
            :src="entry.activity.actorId ? avatarOf(entry.activity.actorId) : null"
            size="xs"
          />
        </span>
        <span class="min-w-0">
          <span class="font-medium text-ink-muted">{{ activityActor(entry.activity, names) }}</span>
          {{ describeActivity(entry.activity, names) }}
          <span aria-hidden="true">·</span>
          <time :datetime="entry.at.toISOString()" :title="fullDate(entry.at)">
            {{ timeAgo(entry.at) }}
          </time>
        </span>
      </p>
    </li>
  </ol>
</template>
