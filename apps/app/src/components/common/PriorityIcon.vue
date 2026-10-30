<script setup lang="ts">
import { computed } from 'vue'
import type { Priority } from '@/lib/priorities'
import { cn } from '@/lib/utils'

const props = defineProps<{ priority: Priority; class?: string }>()

// High = 3 filled bars, Medium = 2, Low = 1.
const filledBars = computed(() => (props.priority >= 2 ? 5 - props.priority : 0))
</script>

<template>
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    :class="
      cn(
        'size-4 shrink-0',
        priority === 1
          ? 'text-priority-urgent'
          : priority === 0
            ? 'text-ink-tertiary'
            : 'text-ink-muted',
        $props.class,
      )
    "
  >
    <template v-if="priority === 0">
      <rect
        v-for="x in [1.5, 6.5, 11.5]"
        :key="x"
        :x="x"
        y="7.25"
        width="3"
        height="1.5"
        rx="0.5"
        fill="currentColor"
      />
    </template>
    <template v-else-if="priority === 1">
      <rect x="1" y="1" width="14" height="14" rx="3" fill="currentColor" />
      <rect x="7.25" y="4" width="1.5" height="5" rx="0.5" class="fill-canvas" />
      <rect x="7.25" y="10.5" width="1.5" height="1.5" rx="0.5" class="fill-canvas" />
    </template>
    <template v-else>
      <rect
        v-for="(bar, i) in [
          { x: 1.5, y: 8, h: 6 },
          { x: 6.5, y: 5, h: 9 },
          { x: 11.5, y: 2, h: 12 },
        ]"
        :key="bar.x"
        :x="bar.x"
        :y="bar.y"
        width="3"
        :height="bar.h"
        rx="1"
        fill="currentColor"
        :opacity="i < filledBars ? 1 : 0.3"
      />
    </template>
  </svg>
</template>
