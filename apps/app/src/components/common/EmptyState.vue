<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    icon?: Component
    title: string
    description?: string
    /** Render the title as a heading when the empty state is the whole page. */
    titleAs?: 'p' | 'h1' | 'h2'
  }>(),
  { icon: undefined, description: undefined, titleAs: 'p' },
)
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
    <component :is="icon" v-if="icon" class="size-10 text-ink-tertiary" aria-hidden="true" />
    <div class="space-y-1">
      <component :is="titleAs" class="font-medium text-ink">{{ title }}</component>
      <p v-if="description" class="max-w-sm text-ink-subtle">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
