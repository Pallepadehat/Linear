<script setup lang="ts">
import { cn } from '@/lib/utils'

withDefaults(defineProps<{ name: string; size?: 'sm' | 'md' }>(), { size: 'sm' })
</script>

<template>
  <span
    aria-hidden="true"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center rounded-xs bg-surface-4 font-semibold text-ink',
        size === 'sm' ? 'size-5 text-[11px]' : 'size-8 text-sm',
      )
    "
  >
    {{ name.trim().charAt(0).toUpperCase() }}
  </span>
</template>
