<script setup lang="ts">
import { Check } from '@lucide/vue'
import { CommandItem } from '@/components/ui/command'

defineProps<{ value: string; selected: boolean }>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <CommandItem
    :value="value"
    :aria-selected="selected"
    class="h-8 rounded-sm text-ink-muted data-[highlighted]:bg-surface-4 data-[highlighted]:text-ink"
    @select="emit('select')"
  >
    <slot />
    <Check v-if="selected" class="ml-auto size-3.5 text-ink-subtle" aria-hidden="true" />
  </CommandItem>
</template>
