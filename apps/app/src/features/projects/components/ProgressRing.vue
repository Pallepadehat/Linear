<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ done: number; total: number }>()
const percent = computed(() => (props.total ? (props.done / props.total) * 100 : 0))
</script>

<template>
  <svg viewBox="0 0 16 16" class="size-3.5 shrink-0 -rotate-90" aria-hidden="true">
    <circle cx="8" cy="8" r="6" class="fill-none stroke-hairline-strong" stroke-width="2" />
    <circle
      v-if="percent > 0"
      cx="8"
      cy="8"
      r="6"
      pathLength="100"
      class="fill-none stroke-status-completed"
      stroke-width="2"
      stroke-linecap="round"
      :stroke-dasharray="`${percent} 100`"
    />
  </svg>
</template>
