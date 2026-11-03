<script setup lang="ts">
import { cn } from '@/lib/utils'
import type { HealthValue } from '../project-health'

// A ring around a dot, colored per health; an empty dashed ring before any update.
defineProps<{ health: HealthValue | null; class?: string }>()
</script>

<template>
  <svg
    viewBox="0 0 14 14"
    aria-hidden="true"
    :class="
      cn(
        'size-3.5 shrink-0',
        health === 'on_track'
          ? 'text-success'
          : health === 'at_risk'
            ? 'text-status-started'
            : health === 'off_track'
              ? 'text-danger'
              : 'text-ink-tertiary',
        $props.class,
      )
    "
  >
    <circle
      cx="7"
      cy="7"
      r="6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      :stroke-dasharray="health ? undefined : '1.4 1.74'"
    />
    <circle v-if="health" cx="7" cy="7" r="3" fill="currentColor" />
  </svg>
</template>
