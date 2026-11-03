<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { projectOptions, projectProgressOptions } from '../queries'
import ProjectProgressBreakdown from './ProjectProgressBreakdown.vue'
import ProjectProgressChart from './ProjectProgressChart.vue'

// Self-contained so any project surface can mount it (lazily, with defineAsyncComponent):
// it loads its own data and reads the target date from the cached project.
const props = defineProps<{ workspaceSlug: string; projectId: string }>()

const {
  data: progress,
  isPending,
  error,
} = useQuery(computed(() => projectProgressOptions(props.workspaceSlug, props.projectId)))
const { data: project } = useQuery(
  computed(() => projectOptions(props.workspaceSlug, props.projectId)),
)

const share = (count: number) => {
  const scope = progress.value?.totals.scope ?? 0
  return scope ? `${Math.round((count / scope) * 100)}%` : '0%'
}
const legend = computed(() => {
  const totals = progress.value?.totals
  if (!totals) return []
  return [
    { label: 'Scope', swatch: 'bg-status-neutral', value: `${totals.scope}` },
    {
      label: 'Started',
      swatch: 'bg-status-started',
      value: `${totals.started} · ${share(totals.started)}`,
    },
    {
      label: 'Completed',
      swatch: 'bg-status-completed',
      value: `${totals.completed} · ${share(totals.completed)}`,
    },
  ]
})
</script>

<template>
  <section
    aria-labelledby="project-progress-title"
    class="grid gap-4 rounded-lg border border-hairline bg-surface-1 p-4"
  >
    <h2 id="project-progress-title" class="text-sm font-medium text-ink">Progress</h2>
    <div v-if="isPending" class="grid gap-3" aria-hidden="true">
      <div class="h-10 animate-pulse rounded-md bg-surface-2" />
      <div class="h-30 animate-pulse rounded-md bg-surface-2" />
    </div>
    <p v-else-if="error || !progress" class="text-ink-subtle">Couldn't load progress.</p>
    <template v-else>
      <dl class="grid grid-cols-3 gap-3">
        <div v-for="item in legend" :key="item.label" class="grid gap-0.5">
          <dt class="flex items-center gap-1.5 text-xs text-ink-subtle">
            <span class="size-2 rounded-full" :class="item.swatch" aria-hidden="true" />
            {{ item.label }}
          </dt>
          <dd class="text-ink tabular-nums">{{ item.value }}</dd>
        </div>
      </dl>
      <p v-if="progress.totals.scope === 0" class="text-ink-subtle">
        Add issues to this project to track its progress.
      </p>
      <template v-else>
        <ProjectProgressChart
          :series="progress.series"
          :target-date="project?.targetDate ?? null"
        />
        <ProjectProgressBreakdown :by-assignee="progress.byAssignee" :by-label="progress.byLabel" />
      </template>
    </template>
  </section>
</template>
