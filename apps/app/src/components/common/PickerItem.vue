<script setup lang="ts">
import { inject, onMounted, onUnmounted } from 'vue'
import { Check } from '@lucide/vue'
import { CommandItem } from '@/components/ui/command'
import { pickerShortcutsKey } from './picker-context'

const props = defineProps<{ value: string; selected: boolean; shortcut?: string }>()
const emit = defineEmits<{ select: [] }>()

const shortcuts = inject(pickerShortcutsKey, null)

onMounted(() => {
  if (props.shortcut) shortcuts?.set(props.shortcut, () => emit('select'))
})
onUnmounted(() => {
  if (props.shortcut) shortcuts?.delete(props.shortcut)
})
</script>

<template>
  <CommandItem
    :value="value"
    class="h-8 gap-2.5 rounded-md px-2.5 text-sm text-ink data-[highlighted]:bg-floating-hover data-[highlighted]:text-ink"
    @select="emit('select')"
  >
    <slot />
    <span class="ml-auto flex items-center gap-3">
      <Check v-if="selected" class="size-4 text-ink" aria-hidden="true" />
      <span v-if="shortcut" class="w-3 text-right text-[13px] text-ink-subtle tabular-nums">
        {{ shortcut }}
      </span>
    </span>
  </CommandItem>
</template>
