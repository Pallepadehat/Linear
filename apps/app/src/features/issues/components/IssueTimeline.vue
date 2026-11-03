<script setup lang="ts">
import type { Activity, LinkedPullRequest } from '@linear/contract'
import UserAvatar from '@/components/common/UserAvatar.vue'
import GitHubIcon from '@/features/github/components/GitHubIcon.vue'
import { pullRequestRef } from '@/features/github/pull-requests'
import { fullDate, timeAgo } from '@/lib/relative-time'
import {
  activityActor,
  describeActivity,
  type ActivityNames,
  type TimelineEntry,
} from '../issue-timeline'

const props = defineProps<{
  entries: TimelineEntry[]
  names: ActivityNames
  avatarOf: (userId: string) => string | null
  pullRequestOf: (id: string) => LinkedPullRequest | undefined
}>()

/** The PR behind a GitHub change, as a 0/1 list so the template can bind it by name. */
const linkedPullRequest = (activity: Activity) => {
  const pr = activity.pullRequestId ? props.pullRequestOf(activity.pullRequestId) : undefined
  return pr ? [pr] : []
}
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
          <GitHubIcon
            v-if="entry.activity.actorType === 'github'"
            class="size-3.5 text-ink-muted"
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
          <template v-for="pr in linkedPullRequest(entry.activity)" :key="pr.id">
            via
            <a
              :href="pr.url"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-xs font-mono text-ink-muted outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >{{ pullRequestRef(pr) }}</a
            >
          </template>
          <span aria-hidden="true" class="mx-1">·</span>
          <time :datetime="entry.at.toISOString()" :title="fullDate(entry.at)">
            {{ timeAgo(entry.at) }}
          </time>
        </span>
      </p>
    </li>
  </ol>
</template>
