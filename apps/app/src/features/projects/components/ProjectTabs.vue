<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import { PROJECT_TABS } from '../project-tabs'

defineProps<{ panelId: string }>()
// Spelled out (not `ProjectTab`) so the SFC compiler can resolve the model type.
const tab = defineModel<'overview' | 'activity' | 'issues'>({ required: true })

const tabEls = useTemplateRef<HTMLButtonElement[]>('tabEls')

// WAI-ARIA tabs with automatic activation: arrows / Home / End move and select.
async function onKeydown(event: KeyboardEvent) {
  const index = PROJECT_TABS.findIndex((t) => t.value === tab.value)
  const last = PROJECT_TABS.length - 1
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]
  if (next === undefined) return
  event.preventDefault()
  tab.value = PROJECT_TABS[next]!.value
  await nextTick()
  tabEls.value?.[next]?.focus()
}
</script>

<template>
  <div role="tablist" aria-label="Project sections" class="flex items-center gap-1">
    <button
      v-for="item in PROJECT_TABS"
      :id="`project-tab-${item.value}`"
      ref="tabEls"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="item.value === tab"
      :aria-controls="panelId"
      :tabindex="item.value === tab ? 0 : -1"
      class="h-7 rounded-full border px-3 font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      :class="
        item.value === tab
          ? 'border-hairline bg-surface-2 text-ink'
          : 'border-transparent text-ink-subtle hover:bg-surface-2 hover:text-ink'
      "
      @click="tab = item.value"
      @keydown="onKeydown"
    >
      {{ item.label }}
    </button>
  </div>
</template>
