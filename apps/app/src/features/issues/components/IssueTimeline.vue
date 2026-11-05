<script setup lang="ts">
import type { Activity, LinkedPullRequest } from '@linear/contract'
import { ChevronsUpDown } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UserAvatar from '@/components/common/UserAvatar.vue'
import GitHubIcon from '@/features/github/components/GitHubIcon.vue'
import { pullRequestRef } from '@/features/github/pull-requests'
import { fullDate, timeAgo } from '@/lib/relative-time'
import { usePreferencesStore } from '@/stores/preferences'
import CommentThread from './CommentThread.vue'
import {
  activityActor,
  describeActivity,
  mentionSource,
  type ActivityNames,
  type TimelineEntry,
} from '../issue-timeline'
import {
  filterTimeline,
  foldTimeline,
  mergeActivity,
  OLDER_FOLD_KEY,
  type TimelineFold,
} from '../timeline-folding'

const props = defineProps<{
  entries: TimelineEntry[]
  names: ActivityNames
  avatarOf: (userId: string) => string | null
  pullRequestOf: (id: string) => LinkedPullRequest | undefined
  workspaceSlug: string
  issueId: string
  currentUserId: string | undefined
}>()

// Filtered (Activity header menu), then — in compact mode — merged and folded.
const preferences = usePreferencesStore()
const expanded = ref(new Set<string>())
// J/K keeps this component mounted while the issue changes; so does toggling compact mode.
watch([() => props.issueId, () => preferences.activityCompact], () => (expanded.value = new Set()))
const items = computed(() => {
  const filtered = filterTimeline(props.entries, preferences.activityFilter)
  if (!preferences.activityCompact) return filtered
  return foldTimeline(mergeActivity(filtered), { expanded: expanded.value })
})
function expand(fold: TimelineFold) {
  expanded.value = new Set([...expanded.value, fold.key])
}
const foldLabel = (fold: TimelineFold) =>
  fold.reason === 'older'
    ? `Show ${fold.count} older ${fold.count === 1 ? 'activity' : 'activities'}`
    : `Show ${fold.count} more ${fold.count === 1 ? 'event' : 'events'}`

/** The whole line as plain text, for the tooltip of a row that truncates. */
function sentence(entry: Extract<TimelineEntry, { type: 'activity' }>) {
  const source = mentionSource(entry.activity)
  const text = `${activityActor(entry.activity, props.names)} ${describeActivity(entry.activity, props.names)}`
  const merged = entry.merged ? ` (${entry.merged} changes)` : ''
  return `${text}${source ? ` ${source.identifier}${source.title ? ` ${source.title}` : ''}` : ''}${merged} · ${fullDate(entry.at)}`
}

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
    // The linked comment may sit behind the "older" fold.
    if (!expanded.value.has(OLDER_FOLD_KEY))
      expanded.value = new Set([...expanded.value, OLDER_FOLD_KEY])
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
  <p v-if="items.length === 0" class="py-2 pl-3.5 text-xs text-ink-subtle">
    {{ preferences.activityFilter === 'comments' ? 'No comments yet' : 'No activity yet' }}
  </p>
  <!-- History rows are 24px and tight; comment threads get a little air around them. -->
  <ol v-else class="flex flex-col">
    <li v-for="item in items" :key="item.key" :class="item.type === 'comment' && 'py-1.5'">
      <button
        v-if="item.type === 'fold'"
        type="button"
        class="-ml-1 flex h-6 items-center gap-2 rounded-md pr-2 pl-[1.125rem] text-xs text-ink-subtle outline-none hover:bg-surface-2 hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-ring"
        :aria-expanded="false"
        @click="expand(item)"
      >
        <ChevronsUpDown class="size-3.5" aria-hidden="true" />
        {{ foldLabel(item) }}
      </button>
      <CommentThread
        v-else-if="item.type === 'comment'"
        :thread="item.comment"
        :workspace-slug="workspaceSlug"
        :issue-id="issueId"
        :current-user-id="currentUserId"
        :highlight-id="highlightId"
      />
      <p v-else class="flex h-6 min-w-0 items-center gap-2 pl-3.5 text-xs text-ink-subtle">
        <span class="flex size-4 shrink-0 items-center justify-center">
          <GitHubIcon v-if="item.activity.actorType === 'github'" class="size-3.5 text-ink-muted" />
          <UserAvatar
            v-else
            :name="activityActor(item.activity, names)"
            :src="item.activity.actorId ? avatarOf(item.activity.actorId) : null"
            size="xs"
          />
        </span>
        <span class="min-w-0 truncate" :title="sentence(item)">
          <span class="font-medium text-ink-muted">{{ activityActor(item.activity, names) }}</span>
          {{ describeActivity(item.activity, names) }}
          <template v-for="source in [mentionSource(item.activity)]" :key="source?.issueId">
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
          <template v-for="pr in linkedPullRequest(item.activity)" :key="pr.id">
            via
            <a
              :href="pr.url"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-xs font-mono text-ink-muted outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >{{ pullRequestRef(pr) }}</a
            >
          </template>
        </span>
        <span class="shrink-0 whitespace-nowrap">
          <span aria-hidden="true" class="mr-1">·</span>
          <time :datetime="item.at.toISOString()" :title="fullDate(item.at)">
            {{ timeAgo(item.at) }}
          </time>
        </span>
      </p>
    </li>
  </ol>
</template>
