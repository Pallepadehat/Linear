<script setup lang="ts">
import { Check, Minus } from '@lucide/vue'

// The bulk-selection checkbox on rows, cards and group headers. Lavender is allowed
// for selected states (docs/design.md → Product UI). Clicks don't reach the row link.
defineProps<{ checked: boolean | 'mixed'; label: string }>()
const emit = defineEmits<{ toggle: [event: MouseEvent] }>()
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="checked === 'mixed' ? 'mixed' : checked"
    :aria-label="label"
    class="flex size-5 shrink-0 cursor-default items-center justify-center rounded-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    @click.stop.prevent="emit('toggle', $event)"
  >
    <span
      class="flex size-3.5 items-center justify-center rounded-xs border transition-colors"
      :class="
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-hairline-strong bg-surface-1'
      "
      aria-hidden="true"
    >
      <Minus v-if="checked === 'mixed'" class="size-2.5" :stroke-width="3" />
      <Check v-else-if="checked" class="size-2.5" :stroke-width="3" />
    </span>
  </button>
</template>
