<script setup lang="ts">
import type { Issue } from '@linear/contract'
import { Layers, ListFilter } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import { computed, ref, watchEffect } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui'
import { resolveDropTarget, toBoardColumns, type BoardColumn as Column } from '../board-columns'
import { useIssueFilters } from '../composables/useIssueFilters'
import { useIssueViewData } from '../composables/useIssueViewData'
import { viewStatusCategories } from '../issue-view'
import BoardColumn from './BoardColumn.vue'
import IssueFilterBar from './IssueFilterBar.vue'

// Spelled out: Vue's SFC compiler can't resolve the zod-inferred `IssueListFilter` for props.
const props = defineProps<{
  workspaceSlug: string
  teamId?: string
  projectId?: string
  /** The view tab (team and All issues pages); My issues and project lists have none. */
  view?: 'all' | 'active' | 'backlog'
}>()

const ui = useUiStore()
const { active: filtered, clear: clearFilters } = useIssueFilters()
const { query, issues, users, labels, statusesByTeam, updateIssue } = useIssueViewData(
  () => props.workspaceSlug,
  () => ({
    teamId: props.teamId,
    projectId: props.projectId,
    statusCategories: viewStatusCategories(props.view),
  }),
)

// Pages are newest-first across all statuses, so every column is only complete
// once every page is in; keep loading in the background. Columns are virtualized.
watchEffect(() => {
  if (query.hasNextPage.value && !query.isFetchingNextPage.value && !query.isError.value)
    void query.fetchNextPage()
})

const columns = computed(() =>
  toBoardColumns(issues.value, statusesByTeam.value, viewStatusCategories(props.view)),
)
// A team board waits for its statuses so empty columns don't pop in afterwards.
const loading = computed(
  () => query.isPending.value || (!!props.teamId && !statusesByTeam.value.has(props.teamId)),
)

const dragging = ref<Issue | null>(null)

function onDragStart(issue: Issue, event: DragEvent) {
  dragging.value = issue
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Firefox only starts a drag with data set.
    event.dataTransfer.setData('text/plain', issue.identifier)
  }
}
// A card scrolled out of its virtualized column during a drag is unmounted
// and never sees its own `dragend`; the document still does.
const endDrag = () => (dragging.value = null)
useEventListener(document, 'dragend', endDrag)
useEventListener(document, 'drop', endDrag)

function dropTarget(column: Column) {
  const issue = dragging.value
  return issue ? resolveDropTarget(issue, column.key, statusesByTeam.value.get(issue.teamId)) : null
}

function onDrop(column: Column) {
  const issue = dragging.value
  const target = dropTarget(column)
  endDrag()
  if (issue && target?.type === 'move')
    updateIssue.mutate({ issue, patch: { status: target.status } })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <IssueFilterBar
      :workspace-slug="workspaceSlug"
      :team-id="teamId"
      :project-id="projectId"
      :hide-filter-menu="!!view"
    />
    <div
      v-if="loading"
      class="flex min-h-0 flex-1 gap-3 overflow-hidden p-3"
      aria-busy="true"
      aria-label="Loading issues"
    >
      <div
        v-for="i in 4"
        :key="i"
        class="flex w-80 shrink-0 flex-col gap-1.5 rounded-lg bg-surface-1 p-1.5"
        aria-hidden="true"
      >
        <div class="flex h-8 items-center gap-2 pl-1.5">
          <span class="size-3.5 animate-pulse rounded-full bg-surface-3" />
          <span class="h-3 w-16 animate-pulse rounded-xs bg-surface-3" />
        </div>
        <div
          v-for="j in 5 - i"
          :key="j"
          class="h-24 animate-pulse rounded-lg border border-hairline bg-board-card"
        />
      </div>
    </div>
    <EmptyState
      v-else-if="query.isError.value"
      title="Couldn't load issues"
      description="Check your connection and try again."
    >
      <Button variant="secondary" size="sm" @click="query.refetch()">Retry</Button>
    </EmptyState>
    <EmptyState
      v-else-if="columns.length === 0 && filtered"
      :icon="ListFilter"
      title="No matching issues"
      description="Try a different search or remove some filters."
    >
      <Button variant="secondary" size="sm" @click="clearFilters">Clear filters</Button>
    </EmptyState>
    <EmptyState
      v-else-if="columns.length === 0"
      :icon="Layers"
      title="No issues yet"
      description="Create an issue to start tracking work."
    >
      <Button size="sm" @click="ui.openCreateIssue({ teamId, projectId })">New issue</Button>
    </EmptyState>
    <div v-else class="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
      <BoardColumn
        v-for="column in columns"
        :key="column.key"
        :column="column"
        :statuses-by-team="statusesByTeam"
        :users="users"
        :labels="labels"
        :dragging-id="dragging?.id ?? null"
        :can-drop="dropTarget(column)?.type === 'move'"
        :creatable="!!teamId"
        @update="(issue, patch) => updateIssue.mutate({ issue, patch })"
        @dragstart="onDragStart"
        @dragend="endDrag"
        @drop="onDrop(column)"
        @create="ui.openCreateIssue({ teamId, projectId, statusId: column.status.id })"
      />
    </div>
  </div>
</template>
