<script setup lang="ts">
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/** A 28px sidebar row; the active route gets the selected surface. */
defineProps<{
  to: RouteLocationRaw
  label: string
  icon?: Component
  badge?: number
  inset?: boolean
}>()
</script>

<template>
  <RouterLink
    :to="to"
    :aria-label="badge ? `${label}, ${badge} unread` : label"
    class="flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-ink-muted outline-hidden hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-surface-4 aria-[current=page]:text-ink"
    :class="inset && 'pl-7'"
  >
    <component :is="icon" v-if="icon" class="size-4 shrink-0" aria-hidden="true" />
    <span class="truncate">{{ label }}</span>
    <span
      v-if="badge"
      class="ml-auto rounded-xs bg-surface-4 px-1 text-xs text-ink-muted tabular-nums"
      aria-hidden="true"
      >{{ badge > 99 ? '99+' : badge }}</span
    >
  </RouterLink>
</template>
