<script setup lang="ts">
import { computed, useId } from 'vue'

// Linear-style milestone glyph: a diamond that fills from the bottom as the milestone's
// issues get done. `progress` is 0–1; without it the outline is dashed ("no milestone").
// A complete milestone uses the completed status token, like the Done icon.
const props = defineProps<{ progress?: number }>()

const clipId = `milestone-${useId()}`
const p = computed(() => Math.min(Math.max(props.progress ?? 0, 0), 1))
// The inner diamond spans y 3.5–10.5; the fill rises from the bottom.
const fillTop = computed(() => 10.5 - 7 * p.value)
</script>

<template>
  <svg
    viewBox="0 0 14 14"
    class="size-3.5 shrink-0"
    :class="p >= 1 ? 'text-status-completed' : 'text-ink-subtle'"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="clipId">
        <rect x="0" :y="fillTop" width="14" :height="14 - fillTop" />
      </clipPath>
    </defs>
    <path
      d="M7 1.25 12.75 7 7 12.75 1.25 7Z"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      :stroke-dasharray="progress === undefined ? '2 1.6' : undefined"
    />
    <path
      v-if="p > 0"
      d="M7 3.5 10.5 7 7 10.5 3.5 7Z"
      fill="currentColor"
      :clip-path="`url(#${clipId})`"
    />
  </svg>
</template>
