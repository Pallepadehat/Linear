<script setup lang="ts">
import { Check } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type { FilterDimension } from '../composables/useFilterDimensions'
import { useIssueFilters } from '../composables/useIssueFilters'
import { DETAILS_TABS, facetRows, type DetailsTab } from '../issue-details'
import { viewStatusCategories } from '../issue-view'
import { issueFacetsOptions } from '../queries'

const props = defineProps<{
  workspaceSlug: string
  teamId?: string
  view: 'all' | 'active' | 'backlog'
  /** The filter menu's dimensions: names, icons and toggles for each value. */
  dimensions: FilterDimension[]
}>()

const { filters } = useIssueFilters()
// Same scope, view and filters as the list next to it.
const { data: facets, isPending } = useQuery(
  computed(() =>
    issueFacetsOptions(
      props.workspaceSlug,
      { teamId: props.teamId, statusCategories: viewStatusCategories(props.view) },
      filters.value,
    ),
  ),
)

const tab = ref<DetailsTab>('assignees')
const rows = computed(() => facetRows(facets.value, tab.value, props.dimensions))

const tabEls = useTemplateRef<HTMLButtonElement[]>('tabEls')

// WAI-ARIA tabs with automatic activation, like the view tabs.
async function onKeydown(event: KeyboardEvent) {
  const index = DETAILS_TABS.findIndex((t) => t.value === tab.value)
  const last = DETAILS_TABS.length - 1
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]
  if (next === undefined) return
  event.preventDefault()
  tab.value = DETAILS_TABS[next]!.value
  await nextTick()
  tabEls.value?.[next]?.focus()
}
</script>

<template>
  <aside
    class="flex w-88 shrink-0 flex-col border-l border-hairline bg-panel"
    aria-label="Issue details"
  >
    <div role="tablist" aria-label="Break down by" class="flex items-center gap-1 p-3">
      <button
        v-for="t in DETAILS_TABS"
        :id="`issue-details-tab-${t.value}`"
        ref="tabEls"
        :key="t.value"
        type="button"
        role="tab"
        :aria-selected="t.value === tab"
        aria-controls="issue-details-panel"
        :tabindex="t.value === tab ? 0 : -1"
        class="h-7 rounded-full border px-3 font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        :class="
          t.value === tab
            ? 'border-hairline bg-surface-2 text-ink'
            : 'border-transparent text-ink-subtle hover:bg-surface-2 hover:text-ink'
        "
        @click="tab = t.value"
        @keydown="onKeydown"
      >
        {{ t.label }}
      </button>
    </div>
    <div
      id="issue-details-panel"
      role="tabpanel"
      :aria-labelledby="`issue-details-tab-${tab}`"
      class="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
    >
      <div v-if="isPending" class="space-y-1 px-1" aria-hidden="true">
        <div v-for="n in 4" :key="n" class="h-8 animate-pulse rounded-md bg-surface-2" />
      </div>
      <p v-else-if="rows.length === 0" class="px-3 py-2 text-ink-subtle">
        {{ facets?.assignees.length ? 'No labels' : 'No issues' }}
      </p>
      <ul v-else class="space-y-px">
        <li v-for="row in rows" :key="row.key">
          <button
            type="button"
            :aria-pressed="row.selected"
            :title="row.selected ? `Remove ${row.label} filter` : `Filter by ${row.label}`"
            class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left outline-hidden transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
            :class="row.selected ? 'bg-surface-2 text-ink' : 'text-ink-muted'"
            @click="row.toggle"
          >
            <span class="flex size-4 shrink-0 items-center justify-center">
              <component :is="row.icon" />
            </span>
            <span class="min-w-0 flex-1 truncate">{{ row.label }}</span>
            <Check v-if="row.selected" class="size-3.5 shrink-0 text-ink" aria-hidden="true" />
            <span class="shrink-0 text-ink-subtle tabular-nums">{{ row.count }}</span>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>
