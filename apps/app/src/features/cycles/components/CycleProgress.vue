<script setup lang="ts">
import type { CycleProgress } from '@linear/contract'
import { computed } from 'vue'
import { cyclePercent } from '../cycles'

const props = defineProps<{ progress: CycleProgress }>()
const percent = computed(() => cyclePercent(props.progress))
</script>

<template>
  <div class="flex items-center gap-3 text-xs text-ink-subtle tabular-nums">
    <div
      class="h-1 w-20 overflow-hidden rounded-full bg-surface-4"
      role="progressbar"
      aria-label="Progress"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${progress.completed} of ${progress.scope} issues completed`"
    >
      <div class="h-full rounded-full bg-status-completed" :style="{ width: `${percent}%` }" />
    </div>
    <span class="w-8 text-right">{{ percent }}%</span>
    <span class="hidden items-center gap-3 sm:flex">
      <span :title="'Issues in the cycle, not counting canceled ones'">
        <span class="text-ink-muted">{{ progress.scope }}</span> scope
      </span>
      <span
        ><span class="text-ink-muted">{{ progress.started }}</span> started</span
      >
      <span
        ><span class="text-ink-muted">{{ progress.completed }}</span> completed</span
      >
    </span>
  </div>
</template>
