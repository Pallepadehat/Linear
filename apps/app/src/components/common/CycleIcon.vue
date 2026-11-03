<script setup lang="ts">
import { computed } from 'vue'

// Linear-style cycle glyph: a ring that fills like a pie as the cycle completes.
// `progress` is 0–1; without it the ring is dashed ("no cycle").
const props = defineProps<{ progress?: number }>()

const R = 3.5
const fill = computed(() => {
  const p = Math.min(Math.max(props.progress ?? 0, 0), 1)
  if (p <= 0) return null
  if (p >= 1) return 'full'
  const angle = p * 2 * Math.PI - Math.PI / 2
  const x = 7 + R * Math.cos(angle)
  const y = 7 + R * Math.sin(angle)
  return `M7 7 L7 ${7 - R} A${R} ${R} 0 ${p > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`
})
</script>

<template>
  <svg viewBox="0 0 14 14" class="size-3.5 shrink-0 text-ink-subtle" fill="none" aria-hidden="true">
    <circle
      cx="7"
      cy="7"
      r="6"
      stroke="currentColor"
      stroke-width="1.5"
      :stroke-dasharray="progress === undefined ? '2 2' : undefined"
    />
    <circle v-if="fill === 'full'" cx="7" cy="7" :r="R" fill="currentColor" />
    <path v-else-if="fill" :d="fill" fill="currentColor" />
  </svg>
</template>
