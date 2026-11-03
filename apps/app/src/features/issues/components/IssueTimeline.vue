<script setup lang="ts">
import type { Activity, LinkedPullRequest } from '@linear/contract'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UserAvatar from '@/components/common/UserAvatar.vue'
import GitHubIcon from '@/features/github/components/GitHubIcon.vue'
import { pullRequestRef } from '@/features/github/pull-requests'
import { fullDate, timeAgo } from '@/lib/relative-time'
import CommentThread from './CommentThread.vue'
import {
  activityActor,
  describeActivity,
  mentionSource,
  type ActivityNames,
  type TimelineEntry,
} from '../issue-timeline'

const props = defineProps<{
  entries: TimelineEntry[]
  names: ActivityNames
  avatarOf: (userId: string) => string | null
  pullRequestOf: (id: string) => LinkedPullRequest | undefined
  workspaceSlug: string
  issueId: string
  currentUserId: string | undefined
}>()

/** The PR behind a GitHub change, as a 0/1 list so the template can bind it by name. */
const linkedPullRequest = (activity: Activity) => {
  const pr = activity.pullRequestId ? props.pullRequestOf(activity.pullRequestId) : undefined
  return pr ? [pr] : []
}

// `#comment-<id>` (Copy link) scrolls to that comment and highlights it briefly,
// once it has loaded.
const route = useRoute()
const linkedId = computed(() => /^#comment-([\w-]+)$/.exec(route.hash)?.[1] ?? null)
const highlightId = ref<string | null>(null)
const commentIds = computed(() =>
  props.entries.flatMap((e) =>
    e.type === 'comment' ? [e.comment.id, ...e.comment.replies.map((r) => r.id)] : [],
  ),
)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  [linkedId, () => commentIds.value.includes(linkedId.value ?? '')],
  async ([id, loaded], previous) => {
    if (!id || !loaded || (previous?.[0] === id && previous[1])) return
    highlightId.value = id
    await nextTick()
    document
      .getElementById(`comment-${id}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    clearTimeout(timer)
    timer = setTimeout(() => (highlightId.value = null), 2000)
  },
  { immediate: true },
)
</script>

<template>
  <ol class="grid gap-3">
    <li v-for="entry in entries" :key="entry.key">
      <CommentThread
        v-if="entry.type === 'comment'"
        :thread="entry.comment"
        :workspace-slug="workspaceSlug"
        :issue-id="issueId"
        :current-user-id="currentUserId"
        :highlight-id="highlightId"
      />
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
        <span class="min-w-0 wrap-anywhere">
          <span class="font-medium text-ink-muted">{{ activityActor(entry.activity, names) }}</span>
          {{ describeActivity(entry.activity, names) }}
          <template v-for="source in [mentionSource(entry.activity)]" :key="source?.issueId">
            <RouterLink
              v-if="source"
              :to="{
                name: 'issue',
                params: { workspaceSlug, identifier: source.identifier },
                hash: source.commentId ? `#comment-${source.commentId}` : undefined,
              }"
              class="rounded-xs text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span class="font-mono">{{ source.identifier }}</span>
              <span v-if="source.title" class="ml-1 hover:underline">{{ source.title }}</span>
            </RouterLink>
          </template>
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
