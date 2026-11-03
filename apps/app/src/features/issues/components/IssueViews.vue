<script setup lang="ts">
import { PanelRight } from '@lucide/vue'
import { computed, defineAsyncComponent, ref } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import { useHotkeys } from '@/composables/useHotkeys'
import { useUiStore } from '@/stores/ui'
import { useDisplayOptions } from '../composables/useDisplayOptions'
import { useFilterDimensions } from '../composables/useFilterDimensions'
import { useIssueFilters } from '../composables/useIssueFilters'
import { useIssueView } from '../composables/useIssueView'
import { displayViewKey } from '../display-options'
import IssueDisplayOptions from './IssueDisplayOptions.vue'
import IssueFilterMenu from './IssueFilterMenu.vue'
import IssueList from './IssueList.vue'
import IssueViewTabs from './IssueViewTabs.vue'

// Drag and drop is only needed once someone opens the board.
const IssueBoard = defineAsyncComponent(() => import('./IssueBoard.vue'))

const props = defineProps<{ workspaceSlug: string; teamId?: string }>()

const PANEL_ID = 'issue-view-panel'

const ui = useUiStore()
const viewKey = computed(() => displayViewKey(props))
const { options } = useDisplayOptions(viewKey)
const { view, select } = useIssueView()
const tab = computed({ get: () => view.value, set: select })

const { filters, update } = useIssueFilters()
const dimensions = useFilterDimensions(() => props, filters, update)

// `F` opens the filter menu, like Linear; ignored while typing.
const filterOpen = ref(false)
useHotkeys([{ id: 'list-filter', run: () => void (filterOpen.value = true) }])
</script>

<template>
  <div
    class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-4"
    role="toolbar"
    aria-label="Issue view"
  >
    <IssueViewTabs v-model="tab" :panel-id="PANEL_ID" />
    <div class="ml-auto flex items-center gap-1">
      <IssueFilterMenu v-model:open="filterOpen" :dimensions="dimensions" compact />
      <IssueDisplayOptions :view-key="viewKey" allow-board />
      <IconButton
        :icon="PanelRight"
        label="Details"
        shortcut="⌘ I"
        aria-keyshortcuts="Meta+I"
        :aria-pressed="ui.issueDetailsOpen"
        :class="{ 'bg-surface-2 text-ink': ui.issueDetailsOpen }"
        @click="ui.issueDetailsOpen = !ui.issueDetailsOpen"
      />
    </div>
  </div>
  <div
    :id="PANEL_ID"
    role="tabpanel"
    :aria-labelledby="`issue-view-tab-${view}`"
    class="flex min-h-0 flex-1 flex-col"
  >
    <IssueBoard
      v-if="options.layout === 'board'"
      :workspace-slug="workspaceSlug"
      :team-id="teamId"
      :view="view"
    />
    <IssueList v-else :workspace-slug="workspaceSlug" :team-id="teamId" :view="view" />
  </div>
</template>
