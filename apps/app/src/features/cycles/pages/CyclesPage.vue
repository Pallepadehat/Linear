<script setup lang="ts">
import type { Cycle } from '@linear/contract'
import { IterationCcw } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import CycleIcon from '@/components/common/CycleIcon.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import CycleProgress from '../components/CycleProgress.vue'
import { cycleName, cyclePercent, cycleRange, cycleState, type CycleState } from '../cycles'
import { cycleListOptions } from '../queries'

const route = useRoute()
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const teamKey = computed(() => String(route.params.teamKey))
const { data: team, error } = useQuery(
  computed(() =>
    orpc.teams.get.queryOptions({ input: { workspaceSlug: slug.value, key: teamKey.value } }),
  ),
)
const { data: cycles, isPending } = useQuery(
  computed(() => ({
    ...cycleListOptions(slug.value, team.value?.id ?? ''),
    enabled: Boolean(team.value),
  })),
)

watchEffect(() => {
  if (team.value) ui.breadcrumb = [team.value.name, 'Cycles']
})

const SECTIONS: { state: CycleState; title: string }[] = [
  { state: 'current', title: 'Current' },
  { state: 'upcoming', title: 'Upcoming' },
  { state: 'past', title: 'Past' },
]
// The server already orders them: current, upcoming soonest first, past newest first.
const sections = computed(() => {
  const now = new Date()
  return SECTIONS.map((section) => ({
    ...section,
    cycles: (cycles.value ?? []).filter((c: Cycle) => cycleState(c, now) === section.state),
  })).filter((section) => section.cycles.length > 0)
})
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="Team not found" />
  <template v-else-if="team">
    <EmptyState
      v-if="!isPending && (cycles?.length ?? 0) === 0"
      :icon="IterationCcw"
      title="Cycles are off"
      :description="`Turn on cycles in ${team.name}'s settings to plan work in time-boxed iterations.`"
    >
      <Button as-child variant="secondary" size="sm">
        <RouterLink :to="{ name: 'team-settings', params: { teamKey: team.key } }">
          Team settings
        </RouterLink>
      </Button>
    </EmptyState>
    <div v-else class="min-h-0 flex-1 overflow-y-auto py-2">
      <section
        v-for="section in sections"
        :key="section.state"
        :aria-labelledby="`cycles-${section.state}`"
        class="grid"
      >
        <h2
          :id="`cycles-${section.state}`"
          class="mx-2 flex h-8 items-center rounded-md bg-group-band px-3 font-medium text-ink"
        >
          {{ section.title }}
          <span class="ml-2 font-normal text-ink-subtle tabular-nums">
            {{ section.cycles.length }}
          </span>
        </h2>
        <ul class="grid py-1">
          <li v-for="cycle in section.cycles" :key="cycle.id">
            <RouterLink
              :to="{ name: 'cycle', params: { teamKey: team.key, cycleId: cycle.id } }"
              class="mx-2 flex h-9 items-center gap-3 rounded-md pr-3 pl-3.5 outline-hidden hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CycleIcon :progress="cyclePercent(cycle.progress) / 100" />
              <span class="min-w-0 truncate font-medium text-ink">{{ cycleName(cycle) }}</span>
              <span class="shrink-0 text-ink-subtle">{{ cycleRange(cycle) }}</span>
              <CycleProgress class="ml-auto" :progress="cycle.progress" />
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </template>
</template>
