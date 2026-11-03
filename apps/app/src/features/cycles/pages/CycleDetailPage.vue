<script setup lang="ts">
import type { CycleDetail } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import IssueList from '@/features/issues/components/IssueList.vue'
import { errorCode, errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import BurnUpChart from '../components/BurnUpChart.vue'
import CycleProgress from '../components/CycleProgress.vue'
import { cycleName, cycleRange, cycleState } from '../cycles'
import { cycleOptions, cyclesKey } from '../queries'

const route = useRoute()
const ui = useUiStore()
const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const cycleId = computed(() => String(route.params.cycleId))
const options = computed(() => cycleOptions(slug.value, cycleId.value))
const { data: cycle, error } = useQuery(options)
const { data: team } = useQuery(
  computed(() =>
    orpc.teams.get.queryOptions({
      input: { workspaceSlug: slug.value, key: String(route.params.teamKey) },
    }),
  ),
)
// A cycle id from another team's URL is treated as not found.
const mismatch = computed(() =>
  Boolean(cycle.value && team.value && cycle.value.teamId !== team.value.id),
)

watchEffect(() => {
  if (cycle.value && team.value) ui.breadcrumb = [team.value.name, 'Cycles', cycleName(cycle.value)]
})

const STATE_LABEL = { current: 'Current', upcoming: 'Upcoming', past: 'Completed' } as const
const state = computed(() => (cycle.value ? cycleState(cycle.value) : 'upcoming'))

// Renames apply at once and roll back if the save fails.
const rename = useMutation({
  mutationFn: (name: string | null) =>
    client.cycles.update({ workspaceSlug: slug.value, id: cycleId.value, name }),
  onMutate: async (name) => {
    const { queryKey } = options.value
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData<CycleDetail>(queryKey)
    if (previous) queryClient.setQueryData(queryKey, { ...previous, name })
    return { previous }
  },
  onError: (err, _name, context) => {
    if (context?.previous) queryClient.setQueryData(options.value.queryKey, context.previous)
    toast.error(errorMessage(err))
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: cyclesKey() }),
})

const nameDraft = ref('')
watch(
  cycle,
  (value) => {
    if (value) nameDraft.value = value.name ?? ''
  },
  { immediate: true },
)
function commitName() {
  if (!cycle.value) return
  const next = nameDraft.value.trim() || null
  nameDraft.value = next ?? ''
  if (next !== cycle.value.name) rename.mutate(next)
}
function revertName(event: KeyboardEvent) {
  nameDraft.value = cycle.value?.name ?? ''
  ;(event.target as HTMLInputElement).blur()
}
</script>

<template>
  <EmptyState
    v-if="errorCode(error) === 'NOT_FOUND' || errorCode(error) === 'BAD_REQUEST' || mismatch"
    title="Cycle not found"
  />
  <EmptyState
    v-else-if="error"
    title="Couldn't load cycle"
    description="Check your connection and try again."
  />
  <div v-else-if="cycle && team" class="flex min-h-0 flex-1 flex-col">
    <section
      aria-label="Cycle details"
      class="grid shrink-0 gap-3 border-b border-hairline px-8 pt-6 pb-5"
    >
      <div class="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
        <span
          class="rounded-xs border border-hairline px-1.5 py-0.5 font-medium"
          :class="state === 'current' ? 'text-ink' : 'text-ink-subtle'"
        >
          {{ STATE_LABEL[state] }}
        </span>
        <span>{{ cycleRange(cycle) }}</span>
      </div>
      <label for="cycle-name" class="sr-only">Cycle name</label>
      <input
        id="cycle-name"
        v-model="nameDraft"
        autocomplete="off"
        maxlength="80"
        :placeholder="`Cycle ${cycle.number}`"
        class="-mx-1 rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight text-ink caret-primary outline-hidden placeholder:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        @blur="commitName"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        @keydown.esc.prevent="revertName"
      />
      <CycleProgress :progress="cycle.progress" />
      <BurnUpChart :cycle="cycle" />
    </section>
    <h2 class="sr-only">Issues</h2>
    <IssueList :key="cycle.id" :workspace-slug="slug" :team-id="team.id" :cycle-id="cycle.id" />
  </div>
</template>
