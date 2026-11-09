<script setup lang="ts">
import { PanelRight, SquareStack } from '@lucide/vue'
import { computed, defineAsyncComponent, ref } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import { useHotkeys } from '@/composables/useHotkeys'
import { useIsMobile } from '@/composables/useIsMobile'
import { isMacPlatform, shortcutKeys } from '@/lib/hotkeys'
import { usePreferencesStore } from '@/stores/preferences'
import { useDisplayOptions } from '../composables/useDisplayOptions'
import { useFilterDimensions } from '../composables/useFilterDimensions'
import { useIssueFilters } from '../composables/useIssueFilters'
import { useIssueView } from '../composables/useIssueView'
import { displayViewKey } from '../display-options'
import { detailsPanelKey } from '../issue-details'
import IssueDetailsPanel from './IssueDetailsPanel.vue'
import IssueDisplayOptions from './IssueDisplayOptions.vue'
import IssueFilterMenu from './IssueFilterMenu.vue'
import IssueList from './IssueList.vue'
import IssueSearchField from './IssueSearchField.vue'
import IssueViewTabs from './IssueViewTabs.vue'

// Drag and drop is only needed once someone opens the board.
const IssueBoard = defineAsyncComponent(() => import('./IssueBoard.vue'))
const SaveViewDialog = defineAsyncComponent(
  () => import('@/features/views/components/SaveViewDialog.vue'),
)

/** `savedViewId`: a saved view's page, which has no tabs and no "Save as view". */
const props = defineProps<{ workspaceSlug: string; teamId?: string; savedViewId?: string }>()

const PANEL_ID = 'issue-view-panel'

const preferences = usePreferencesStore()
const isMobile = useIsMobile()
const viewKey = computed(() => displayViewKey(props))
const { options } = useDisplayOptions(viewKey)
const { view: tabView, select } = useIssueView()
// A saved view lists what its filters say, so the tabs don't apply.
const view = computed(() => (props.savedViewId ? 'all' : tabView.value))
const tab = computed({ get: () => view.value, set: select })
const saveViewOpen = ref(false)

const { filters, update } = useIssueFilters()
const dimensions = useFilterDimensions(() => props, filters, update)

// `F` opens the filter menu, like Linear; ignored while typing.
const filterOpen = ref(false)
// The Details panel (⌘I, Ctrl+I elsewhere), remembered per view.
const detailsKey = computed(() => detailsPanelKey(props.teamId, view.value))
const detailsOpen = computed(() => preferences.isDetailsOpen(detailsKey.value))
const toggleDetails = () => preferences.toggleDetails(detailsKey.value)
const detailsShortcut = shortcutKeys('list-details')[0]!.join(' ')

useHotkeys([
  { id: 'list-filter', run: () => void (filterOpen.value = true) },
  { id: 'list-details', run: toggleDetails },
])
</script>

<template>
  <!-- One toolbar for the view: tabs on the left; search, Filter, Display options, Save as view
       and the Details panel on the right. Active filter chips get their own row below. -->
  <div
    class="relative flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-2 md:pl-4"
    role="toolbar"
    aria-label="Issue view"
  >
    <IssueViewTabs v-if="!savedViewId" v-model="tab" :panel-id="PANEL_ID" />
    <slot name="toolbar" />
    <div class="ml-auto flex shrink-0 items-center gap-1">
      <IssueSearchField collapsible />
      <IssueFilterMenu v-model:open="filterOpen" :dimensions="dimensions" compact />
      <IssueDisplayOptions :view-key="viewKey" allow-board />
      <template v-if="!savedViewId">
        <IconButton :icon="SquareStack" label="Save as view" @click="saveViewOpen = true" />
        <SaveViewDialog
          v-if="saveViewOpen"
          v-model:open="saveViewOpen"
          :team-id="teamId"
          :filters="filters"
          :display="options"
        />
      </template>
      <IconButton
        :icon="PanelRight"
        :label="detailsOpen ? 'Close details' : 'Open details'"
        :shortcut="detailsShortcut"
        :aria-keyshortcuts="isMacPlatform() ? 'Meta+I' : 'Control+I'"
        :aria-pressed="detailsOpen"
        class="max-md:hidden"
        :class="{ 'bg-surface-2 text-ink': detailsOpen }"
        @click="toggleDetails"
      />
    </div>
  </div>
  <div class="flex min-h-0 flex-1">
    <div
      :id="PANEL_ID"
      :role="savedViewId ? undefined : 'tabpanel'"
      :aria-labelledby="savedViewId ? undefined : `issue-view-tab-${view}`"
      class="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <IssueBoard
        v-if="options.layout === 'board'"
        :workspace-slug="workspaceSlug"
        :saved-view-id="savedViewId"
        :team-id="teamId"
        :view="view"
      />
      <IssueList
        v-else
        :workspace-slug="workspaceSlug"
        :saved-view-id="savedViewId"
        :team-id="teamId"
        :view="view"
      />
    </div>
    <IssueDetailsPanel
      v-if="detailsOpen && !isMobile"
      :workspace-slug="workspaceSlug"
      :saved-view-id="savedViewId"
      :team-id="teamId"
      :view="view"
      :dimensions="dimensions"
    />
  </div>
</template>
