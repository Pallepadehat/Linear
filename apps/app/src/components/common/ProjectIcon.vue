<script setup lang="ts">
import { Box } from '@lucide/vue'
import { cn } from '@/lib/utils'

// The uploaded icon, or a neutral box glyph when the project has none.
withDefaults(defineProps<{ src?: string | null; size?: 'sm' | 'md' | 'lg' }>(), {
  src: null,
  size: 'sm',
})

const sizeClass = { sm: 'size-4', md: 'size-5', lg: 'size-8' }
</script>

<template>
  <img
    v-if="src"
    :src="src"
    alt=""
    :class="cn('shrink-0 rounded-xs object-cover', sizeClass[size])"
  />
  <span
    v-else
    aria-hidden="true"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center text-ink-subtle',
        sizeClass[size],
        size === 'lg' && 'rounded-md border border-hairline bg-surface-2',
      )
    "
  >
    <Box :class="size === 'lg' ? 'size-4.5' : 'size-full'" />
  </span>
</template>
