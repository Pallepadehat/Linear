<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { cn } from '@/lib/utils'

const { mode } = useTheme()
const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Theme"
    class="inline-flex gap-1 rounded-md border border-hairline bg-surface-1 p-1"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="mode === option.value"
      :class="
        cn(
          'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-ink-subtle hover:text-ink',
          mode === option.value && 'bg-surface-3 text-ink',
        )
      "
      @click="mode = option.value"
    >
      <component :is="option.icon" class="size-3.5" aria-hidden="true" />
      {{ option.label }}
    </button>
  </div>
</template>
