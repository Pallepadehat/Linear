<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'

const route = useRoute()
const { slug } = useCurrentWorkspace()
const { data: team, error } = useQuery(
  computed(() =>
    orpc.teams.get.queryOptions({
      input: { workspaceSlug: slug.value, key: String(route.params.teamKey) },
    }),
  ),
)

const categoryLabel = {
  backlog: 'Backlog',
  unstarted: 'Unstarted',
  started: 'Started',
  completed: 'Completed',
  canceled: 'Canceled',
} as const
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="Team not found" />
  <div v-else-if="team" class="mx-auto grid w-full max-w-3xl gap-8 px-6 py-8">
    <div class="flex items-baseline gap-3">
      <h2 class="text-xl font-semibold tracking-tight text-ink">{{ team.name }}</h2>
      <span class="font-mono text-ink-subtle">{{ team.key }}</span>
    </div>
    <section aria-labelledby="statuses-heading" class="grid gap-3">
      <h3 id="statuses-heading" class="text-xs font-medium tracking-wide text-ink-subtle uppercase">
        Workflow
      </h3>
      <ul class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1">
        <li
          v-for="status in team.statuses"
          :key="status.id"
          class="flex items-center justify-between px-4 py-2.5"
        >
          <span class="text-ink">{{ status.name }}</span>
          <span class="text-xs text-ink-subtle">{{ categoryLabel[status.category] }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
