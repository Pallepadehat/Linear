<script setup lang="ts">
import { computed } from 'vue'

// A pie that fills with the share of completed sub-issues, in the Done status color.
const props = defineProps<{ done: number; total: number }>()

const RADIUS = 3
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const filled = computed(() =>
  props.total === 0 ? 0 : Math.min(1, props.done / props.total) * CIRCUMFERENCE,
)
</script>

<template>
  <svg viewBox="0 0 14 14" class="size-3.5 shrink-0 text-status-completed" aria-hidden="true">
    <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.5" />
    <circle
      cx="7"
      cy="7"
      :r="RADIUS"
      fill="none"
      stroke="currentColor"
      :stroke-width="RADIUS * 2"
      :stroke-dasharray="`${filled} ${CIRCUMFERENCE}`"
      transform="rotate(-90 7 7)"
    />
  </svg>
</template>
