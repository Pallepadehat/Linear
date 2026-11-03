<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { orpc } from '@/lib/orpc'
import { projectActivityRow } from '../project-activity'
import { projectActivityPreviewOptions } from '../queries'
import ProjectActivityItem from './ProjectActivityItem.vue'

// Self-contained so the project right panel (M9-03) can slot it in as is.
const props = defineProps<{ workspaceSlug: string; projectId: string }>()

const route = useRoute()
const { data, isPending, isError } = useQuery(
  computed(() => projectActivityPreviewOptions(props.workspaceSlug, props.projectId)),
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
  (data.value?.items ?? []).map((entry) => projectActivityRow(entry, names)),
)
</script>

<template>
  <section
    aria-labelledby="project-activity-heading"
    class="grid gap-2 rounded-lg border border-hairline bg-surface-1 p-3"
  >
    <header class="flex items-center justify-between">
      <h2 id="project-activity-heading" class="text-xs font-medium text-ink-subtle">Activity</h2>
      <RouterLink
        :to="{ query: { ...route.query, tab: 'activity' } }"
        class="rounded-xs text-xs text-ink-subtle outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
      >
        See all
      </RouterLink>
    </header>
    <p v-if="isError" class="text-xs text-ink-subtle">Couldn't load activity.</p>
    <p v-else-if="!isPending && !entries.length" class="text-xs text-ink-subtle">
      No activity yet.
    </p>
    <ol v-else class="grid gap-2">
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
  </section>
</template>
