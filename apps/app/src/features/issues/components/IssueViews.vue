<script setup lang="ts">
import { PanelRight, SlidersHorizontal } from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { computed, defineAsyncComponent, ref } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import { PANEL_HEADER_ACTIONS } from '@/layouts/panel-header'
import { isPlainShortcut, isTypingTarget } from '@/lib/keyboard'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiStore } from '@/stores/ui'
import { useFilterDimensions } from '../composables/useFilterDimensions'
import { useIssueFilters } from '../composables/useIssueFilters'
import { useIssueView } from '../composables/useIssueView'
import { detailsPanelKey } from '../issue-details'
import IssueDetailsPanel from './IssueDetailsPanel.vue'
import IssueFilterMenu from './IssueFilterMenu.vue'
import IssueLayoutToggle from './IssueLayoutToggle.vue'
import IssueList from './IssueList.vue'
import IssueViewTabs from './IssueViewTabs.vue'

// Drag and drop is only needed once someone opens the board.
const IssueBoard = defineAsyncComponent(() => import('./IssueBoard.vue'))

const props = defineProps<{ workspaceSlug: string; teamId?: string }>()

const PANEL_ID = 'issue-view-panel'

const preferences = usePreferencesStore()
const ui = useUiStore()
const { view, select } = useIssueView()
const tab = computed({ get: () => view.value, set: select })

const { filters, update } = useIssueFilters()
const dimensions = useFilterDimensions(() => props, filters, update)

// `F` opens the filter menu, like Linear; ignored while typing.
const filterOpen = ref(false)
onKeyStroke('f', (event) => {
  if (ui.createIssueOpen || !isPlainShortcut(event)) return
  event.preventDefault()
  filterOpen.value = true
})

// The Details panel (⌘I, Ctrl+I elsewhere), remembered per view.
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const detailsKey = computed(() => detailsPanelKey(props.teamId, view.value))
const detailsOpen = computed(() => preferences.isDetailsOpen(detailsKey.value))
const toggleDetails = () => preferences.toggleDetails(detailsKey.value)
onKeyStroke('i', (event) => {
  const modifier = isMac ? event.metaKey : event.ctrlKey
  if (!modifier || event.altKey || event.shiftKey || ui.createIssueOpen) return
  // ⌘I is italic in the editor.
  if (isTypingTarget(event.target)) return
  event.preventDefault()
  toggleDetails()
})
</script>

<template>
  <Teleport defer :to="PANEL_HEADER_ACTIONS">
    <IssueLayoutToggle />
  </Teleport>
  <div
    class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-4"
    role="toolbar"
    aria-label="Issue view"
  >
    <IssueViewTabs v-model="tab" :panel-id="PANEL_ID" />
    <div class="ml-auto flex items-center gap-1">
      <IssueFilterMenu v-model:open="filterOpen" :dimensions="dimensions" compact />
      <!-- Placeholder until the display options popover (M7-03). -->
      <IconButton :icon="SlidersHorizontal" label="Display options" />
      <IconButton
        :icon="PanelRight"
        :label="detailsOpen ? 'Close details' : 'Open details'"
        :shortcut="isMac ? '⌘ I' : 'Ctrl I'"
        :aria-keyshortcuts="isMac ? 'Meta+I' : 'Control+I'"
        :aria-pressed="detailsOpen"
        :class="{ 'bg-surface-2 text-ink': detailsOpen }"
        @click="toggleDetails"
      />
    </div>
  </div>
  <div class="flex min-h-0 flex-1">
    <div
      :id="PANEL_ID"
      role="tabpanel"
      :aria-labelledby="`issue-view-tab-${view}`"
      class="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <IssueBoard
        v-if="preferences.issueLayout === 'board'"
        :workspace-slug="workspaceSlug"
        :team-id="teamId"
        :view="view"
      />
      <IssueList v-else :workspace-slug="workspaceSlug" :team-id="teamId" :view="view" />
    </div>
    <IssueDetailsPanel
      v-if="detailsOpen"
      :workspace-slug="workspaceSlug"
      :team-id="teamId"
      :view="view"
      :dimensions="dimensions"
    />
  </div>
</template>
