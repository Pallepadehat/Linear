<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{ name: string; src?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' }>(),
  {
    src: null,
    size: 'sm',
  },
)

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
)

const sizeClass = {
  xs: 'size-4 text-[8px]',
  sm: 'size-5 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-16 text-xl',
}
</script>

<!-- Decorative: every avatar sits next to the person's name, so screen readers skip the initials. -->
<template>
  <Avatar :class="cn(sizeClass[size], 'bg-surface-3')" aria-hidden="true">
    <AvatarImage v-if="src" :src="src" alt="" />
    <AvatarFallback class="bg-surface-3 font-medium text-ink-muted">{{ initials }}</AvatarFallback>
  </Avatar>
</template>
