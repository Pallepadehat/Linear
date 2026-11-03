<script setup lang="ts">
import type { ProjectProgress } from '@linear/contract'
import { computed } from 'vue'
import { progressPercent } from '../project-status'

const props = defineProps<{ progress: ProjectProgress }>()
const percent = computed(() => progressPercent(props.progress))
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="h-1 w-16 overflow-hidden rounded-full bg-surface-3"
      role="progressbar"
      aria-label="Progress"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${progress.completed} of ${progress.total} issues completed`"
    >
      <div class="h-full rounded-full bg-status-completed" :style="{ width: `${percent}%` }" />
    </div>
    <span class="text-xs text-ink-subtle tabular-nums">
      {{ progress.completed }} / {{ progress.total }}
    </span>
  </div>
</template>
