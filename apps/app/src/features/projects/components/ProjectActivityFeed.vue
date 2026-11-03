<script setup lang="ts">
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { useIntersectionObserver } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { orpc } from '@/lib/orpc'
import { projectActivityRow } from '../project-activity'
import { projectActivityListOptions } from '../queries'
import ProjectActivityItem from './ProjectActivityItem.vue'

// The full feed for the Activity tab, newest first; older pages load on scroll.
const props = defineProps<{ workspaceSlug: string; projectId: string }>()

const activity = useInfiniteQuery(
  computed(() => projectActivityListOptions(props.workspaceSlug, props.projectId)),
)
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: props.workspaceSlug } }),
  ),
)
const names = {
  member: (id: string) => members.value?.find((m) => m.userId === id)?.name,
}
const entries = computed(() =>
  (activity.data.value?.pages ?? [])
    .flatMap((page) => page.items)
    .map((entry) => projectActivityRow(entry, names)),
)

const sentinel = useTemplateRef<HTMLElement>('sentinel')
useIntersectionObserver(sentinel, ([hit]) => {
  if (hit?.isIntersecting && activity.hasNextPage.value && !activity.isFetchingNextPage.value)
    void activity.fetchNextPage()
})
</script>

<template>
  <section aria-labelledby="project-activity-feed-heading" class="grid content-start gap-3">
    <h2 id="project-activity-feed-heading" class="text-[13px] font-medium text-ink">Activity</h2>
    <p v-if="activity.isError.value" class="text-xs text-ink-subtle">Couldn't load activity.</p>
    <p v-else-if="!activity.isPending.value && !entries.length" class="text-xs text-ink-subtle">
      No activity yet.
    </p>
    <ol v-else class="grid gap-3">
      <li v-for="entry in entries" :key="entry.id">
        <ProjectActivityItem
          :line="entry.line"
          :avatar-name="entry.avatarName"
          :avatar-url="entry.avatarUrl"
          :github="entry.github"
          :at="entry.at"
        />
      </li>
    </ol>
    <div ref="sentinel" aria-hidden="true" class="h-px" />
    <p v-if="activity.isFetchingNextPage.value" class="text-xs text-ink-subtle">Loading…</p>
  </section>
</template>
