<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <span
    data-slot="dropdown-menu-shortcut"
    :class="cn('ml-auto pl-3 text-xs tracking-normal text-ink-subtle', props.class)"
  >
    <slot />
  </span>
</template>
