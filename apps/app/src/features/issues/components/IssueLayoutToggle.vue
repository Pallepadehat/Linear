<script setup lang="ts">
import { Columns3, List } from '@lucide/vue'
import { nextTick, useTemplateRef } from 'vue'
import { usePreferencesStore, type IssueLayout } from '@/stores/preferences'

const LAYOUTS = [
  { value: 'list', label: 'List', icon: List },
  { value: 'board', label: 'Board', icon: Columns3 },
] as const satisfies { value: IssueLayout; label: string; icon: unknown }[]

const preferences = usePreferencesStore()
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')

// Arrow keys move the choice, like a radio group.
async function onKeydown(event: KeyboardEvent) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!step) return
  event.preventDefault()
  const index = LAYOUTS.findIndex((l) => l.value === preferences.issueLayout)
  const next = (index + step + LAYOUTS.length) % LAYOUTS.length
  preferences.issueLayout = LAYOUTS[next]!.value
  await nextTick()
  buttons.value?.[next]?.focus()
}
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Layout"
    class="flex items-center gap-0.5 rounded-full border border-hairline p-0.5"
  >
    <button
      v-for="layout in LAYOUTS"
      ref="buttons"
      :key="layout.value"
      type="button"
      role="radio"
      :aria-checked="preferences.issueLayout === layout.value"
      :aria-label="layout.label"
      :title="layout.label"
      :tabindex="preferences.issueLayout === layout.value ? 0 : -1"
      class="flex size-6 items-center justify-center rounded-full outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      :class="
        preferences.issueLayout === layout.value
          ? 'bg-surface-3 text-ink'
          : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
      "
      @click="preferences.issueLayout = layout.value"
      @keydown="onKeydown"
    >
      <component :is="layout.icon" class="size-3.5" aria-hidden="true" />
    </button>
  </div>
</template>
