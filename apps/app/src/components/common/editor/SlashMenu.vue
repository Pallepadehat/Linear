<script setup lang="ts">
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import type { SlashCommand } from './slash-commands'

// Presentational `/` menu; MarkdownEditor owns the state and the keyboard handling.
const props = defineProps<{
  items: SlashCommand[]
  active: number
  /** Caret rect from the suggestion plugin. */
  getRect: () => DOMRect | null
}>()
const emit = defineEmits<{ select: [command: SlashCommand]; hover: [index: number] }>()

const menu = useTemplateRef<HTMLElement>('menu')
const style = ref<Record<string, string>>({ left: '0px', top: '0px' })

// floating-ui places it under the caret, flipping above when there's no room.
const reference = { getBoundingClientRect: () => props.getRect() ?? new DOMRect() }
let stop: (() => void) | undefined
watch(
  menu,
  (el) => {
    stop?.()
    if (!el) return
    stop = autoUpdate(reference, el, async () => {
      const { x, y } = await computePosition(reference, el, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      })
      style.value = { left: `${x}px`, top: `${y}px` }
    })
  },
  { immediate: true },
)
onBeforeUnmount(() => stop?.())

watch(
  () => props.active,
  (index) =>
    menu.value?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }),
)
</script>

<template>
  <div
    ref="menu"
    role="listbox"
    aria-label="Insert block"
    class="fixed z-50 max-h-72 w-60 overflow-y-auto rounded-lg border border-hairline-strong bg-floating p-1.5 shadow-floating"
    :style="style"
    @mousedown.prevent
  >
    <p v-if="items.length === 0" class="px-2.5 py-2 text-ink-subtle">No results</p>
    <button
      v-for="(item, i) in items"
      :key="item.id"
      type="button"
      role="option"
      :data-index="i"
      :aria-selected="i === active"
      class="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-ink aria-selected:bg-floating-hover"
      @mouseenter="emit('hover', i)"
      @click="emit('select', item)"
    >
      <component :is="item.icon" class="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
      <span class="flex-1 truncate">{{ item.label }}</span>
      <kbd class="font-mono text-xs text-ink-tertiary">{{ item.hint }}</kbd>
    </button>
  </div>
</template>
