<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{ class?: string }>()
</script>

<template>
  <!-- A small stacked-triangle glyph, like Linear's estimate icon. -->
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    :class="cn('size-4 shrink-0 text-ink-subtle', $props.class)"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linejoin="round"
  >
    <path d="M8 2.5 13.5 12.5h-11L8 2.5Z" />
    <path d="M5.25 8h5.5" />
  </svg>
</template>
