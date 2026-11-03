<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'
import { ISSUE_VIEWS, type IssueView } from '../issue-view'

defineProps<{ panelId: string }>()
// Spelled out (not `IssueView`) so the SFC compiler can resolve the model type.
const view = defineModel<'all' | 'active' | 'backlog'>({ required: true })

const tabEls = useTemplateRef<HTMLButtonElement[]>('tabEls')

// WAI-ARIA tabs with automatic activation: arrows / Home / End move and select.
async function onKeydown(event: KeyboardEvent) {
  const index = ISSUE_VIEWS.findIndex((v) => v.value === view.value)
  const last = ISSUE_VIEWS.length - 1
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]
  if (next === undefined) return
  event.preventDefault()
  select(ISSUE_VIEWS[next]!.value)
  await nextTick()
  tabEls.value?.[next]?.focus()
}

function select(value: IssueView) {
  view.value = value
}
</script>

<template>
  <div role="tablist" aria-label="Issue views" class="flex items-center gap-1">
    <button
      v-for="tab in ISSUE_VIEWS"
      :id="`issue-view-tab-${tab.value}`"
      ref="tabEls"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="tab.value === view"
      :aria-controls="panelId"
      :tabindex="tab.value === view ? 0 : -1"
      class="h-7 rounded-full border px-3 font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      :class="
        tab.value === view
          ? 'border-hairline bg-surface-2 text-ink'
          : 'border-transparent text-ink-subtle hover:bg-surface-2 hover:text-ink'
      "
      @click="select(tab.value)"
      @keydown="onKeydown"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
