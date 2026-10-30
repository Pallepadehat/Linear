<script setup lang="ts">
import type { StatusCategory } from '@linear/contract'
import { cn } from '@/lib/utils'

// Driven by category, never the status name (domain.md → Statuses).
defineProps<{ category: StatusCategory; class?: string }>()
</script>

<template>
  <svg
    viewBox="0 0 14 14"
    aria-hidden="true"
    :class="
      cn(
        'size-3.5 shrink-0',
        category === 'started'
          ? 'text-status-started'
          : category === 'completed'
            ? 'text-success'
            : 'text-ink-subtle',
        $props.class,
      )
    "
  >
    <circle
      v-if="category === 'backlog'"
      cx="7"
      cy="7"
      r="6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-dasharray="1.4 1.74"
    />
    <circle
      v-else-if="category === 'unstarted'"
      cx="7"
      cy="7"
      r="6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <template v-else-if="category === 'started'">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M7 3.5a3.5 3.5 0 0 1 0 7Z" fill="currentColor" />
    </template>
    <template v-else>
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      <path
        v-if="category === 'completed'"
        d="M4.25 7.25 6.1 9.1 9.9 5.15"
        fill="none"
        class="stroke-canvas"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else
        d="M4.9 4.9 9.1 9.1M9.1 4.9 4.9 9.1"
        class="stroke-canvas"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </template>
  </svg>
</template>
