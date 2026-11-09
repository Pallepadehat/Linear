<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    name: string
    src?: string | null
    size?: 'xs' | 'sm' | 'md' | 'lg'
    /** Shows an online (active) or away dot; offline or unset shows none. */
    presence?: 'active' | 'away' | 'offline' | null
  }>(),
  {
    src: null,
    size: 'sm',
    presence: null,
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

const dotSize = { xs: 'size-1.5', sm: 'size-2', md: 'size-2.5', lg: 'size-4' }
</script>

<!-- Decorative: every avatar sits next to the person's name (and status text), so screen readers skip it. -->
<template>
  <span class="relative inline-flex shrink-0 rounded-full" aria-hidden="true">
    <Avatar :class="cn(sizeClass[size], 'bg-surface-3')">
      <AvatarImage v-if="src" :src="src" alt="" />
      <AvatarFallback class="bg-surface-3 font-medium text-ink-muted">{{
        initials
      }}</AvatarFallback>
    </Avatar>
    <!-- Ringed in the surface color (panel unless a parent sets --avatar-ring) so the dot reads as cut out. -->
    <span
      v-if="presence === 'active' || presence === 'away'"
      data-testid="presence-dot"
      :data-presence="presence"
      :class="
        cn(
          'absolute -right-px -bottom-px rounded-full ring-2 ring-[var(--avatar-ring,var(--panel))]',
          dotSize[size],
          presence === 'active'
            ? 'bg-success'
            : 'border-[1.5px] border-ink-subtle bg-[var(--avatar-ring,var(--panel))]',
        )
      "
    />
  </span>
</template>
