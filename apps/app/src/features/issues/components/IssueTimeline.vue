<script setup lang="ts">
import { GitPullRequest } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { fullDate, timeAgo } from '@/lib/relative-time'
import CommentThread from './CommentThread.vue'
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
  workspaceSlug: string
  issueId: string
  currentUserId: string | undefined
}>()

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
          <span aria-hidden="true" class="mx-1">·</span>
          <time :datetime="entry.at.toISOString()" :title="fullDate(entry.at)">
            {{ timeAgo(entry.at) }}
          </time>
        </span>
      </p>
    </li>
  </ol>
</template>
