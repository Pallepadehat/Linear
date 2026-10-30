<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    :class="cn('size-4 shrink-0 text-ink-subtle', $props.class)"
  >
    <circle
      cx="8"
      cy="8"
      r="7"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-dasharray="1.6 1.6"
    />
    <circle cx="8" cy="6.25" r="2.25" fill="currentColor" />
    <path d="M4.25 12.25a3.75 3.25 0 0 1 7.5 0Z" fill="currentColor" />
  </svg>
</template>
