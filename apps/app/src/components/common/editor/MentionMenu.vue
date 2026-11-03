<script setup lang="ts">
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import type { MentionItem } from './mention-suggestions'

// Presentational `@` / `#` menu; useMentionSuggestions owns the state and the keys.
const props = defineProps<{
  kind: 'user' | 'issue'
  items: MentionItem[]
  active: number
  loading?: boolean
  /** Caret rect from the suggestion plugin. */
  getRect: () => DOMRect | null
}>()
const emit = defineEmits<{ select: [item: MentionItem]; hover: [index: number] }>()

const menu = useTemplateRef<HTMLElement>('menu')
const style = ref<Record<string, string>>({ left: '0px', top: '0px' })

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
    :aria-label="kind === 'user' ? 'Mention a teammate' : 'Mention an issue'"
    class="fixed z-50 max-h-[min(20rem,60vh)] w-80 overflow-y-auto rounded-lg border border-hairline-strong bg-floating p-1 shadow-floating"
    :style="style"
    @mousedown.prevent
  >
    <p v-if="items.length === 0" class="px-2.5 py-2 text-[13px] text-ink-subtle">
      {{ loading ? 'Searching…' : 'No results' }}
    </p>
    <button
      v-for="(item, i) in items"
      :id="`mention-option-${item.id}`"
      :key="item.id"
      type="button"
      role="option"
      :data-index="i"
      :aria-selected="i === active"
      class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-ink aria-selected:bg-floating-hover"
      @mouseenter="emit('hover', i)"
      @click="emit('select', item)"
    >
      <template v-if="item.kind === 'user'">
        <UserAvatar :name="item.label" :src="item.avatarUrl" size="sm" />
        <span class="truncate">{{ item.label }}</span>
        <span class="ml-auto truncate text-xs text-ink-subtle">{{ item.email }}</span>
      </template>
      <template v-else>
        <StatusIcon :category="item.category" />
        <span class="shrink-0 font-mono text-xs text-ink-muted">{{ item.identifier }}</span>
        <span class="truncate">{{ item.title }}</span>
      </template>
    </button>
  </div>
</template>
