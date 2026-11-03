<script setup lang="ts">
import { ChevronDown, Layers, ListFilter, Plus } from '@lucide/vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui'
import { useIssueFilters } from '../composables/useIssueFilters'
import { groupIssuesByStatus, toListRows, type IssueListRow } from '../group-issues'
import { useIssueViewData } from '../composables/useIssueViewData'
import IssueFilterBar from './IssueFilterBar.vue'
import IssueRow from './IssueRow.vue'

// Spelled out: Vue's SFC compiler can't resolve the zod-inferred `IssueListFilter` for props.
const props = defineProps<{
  workspaceSlug: string
  teamId?: string
  projectId?: string
  assignee?: 'me'
  creator?: 'me'
}>()
// Replaces the default "No issues yet" state, e.g. for My Issues tabs.
defineSlots<{ empty?: () => unknown }>()

const GROUP_HEIGHT = 40
const ROW_HEIGHT = 36
// Start loading the next page this many rows before the end.
const PREFETCH_ROWS = 20

const ui = useUiStore()
const { filters, active: filtered, clear: clearFilters } = useIssueFilters()
const { query, issues, users, labels, statusesByTeam, updateIssue } = useIssueViewData(
  () => props.workspaceSlug,
  () => ({
    teamId: props.teamId,
    projectId: props.projectId,
    assignee: props.assignee,
    creator: props.creator,
  }),
)
const collapsed = ref(new Set<string>())
const rows = computed(() => toListRows(groupIssuesByStatus(issues.value), collapsed.value))

function toggleGroup(key: string) {
  const next = new Set(collapsed.value)
  if (!next.delete(key)) next.add(key)
  collapsed.value = next
}

const scrollEl = ref<HTMLElement | null>(null)
const rowHeight = (row: IssueListRow | undefined) =>
  row?.type === 'group' ? GROUP_HEIGHT : ROW_HEIGHT

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollEl.value,
    estimateSize: (index: number) => rowHeight(rows.value[index]),
    getItemKey: (index: number) => rows.value[index]?.key ?? index,
    overscan: 10,
  })),
)
const virtualRows = computed(() =>
  virtualizer.value.getVirtualItems().flatMap((item) => {
    const row = rows.value[item.index]
    return row ? [{ item, row }] : []
  }),
)

// A new page can add issues to a group above the viewport (pages are newest-first,
// groups are by status). Keep the first visible row in place instead of letting it jump.
function offsetOf(list: IssueListRow[], key: string) {
  let offset = 0
  for (const row of list) {
    if (row.key === key) return offset
    offset += rowHeight(row)
  }
  return null
}
watch(rows, async (next, prev) => {
  const el = scrollEl.value
  const anchor = prev[virtualizer.value.range?.startIndex ?? 0]
  if (!el || !anchor || el.scrollTop === 0) return
  const before = offsetOf(prev, anchor.key)
  const after = offsetOf(next, anchor.key)
  if (before === null || after === null || before === after) return
  await nextTick()
  el.scrollTop += after - before
})

// A new filter or sort is a different list; start it from the top.
watch(filters, () => {
  if (scrollEl.value) scrollEl.value.scrollTop = 0
})

watchEffect(() => {
  const last = virtualRows.value.at(-1)
  if (!last || last.item.index < rows.value.length - PREFETCH_ROWS) return
  if (query.hasNextPage.value && !query.isFetchingNextPage.value) void query.fetchNextPage()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <IssueFilterBar :workspace-slug="workspaceSlug" :team-id="teamId" :project-id="projectId" />
    <div v-if="query.isPending.value" class="grid" aria-busy="true" aria-label="Loading issues">
      <div
        v-for="i in 8"
        :key="i"
        class="mx-2 flex h-9 animate-pulse items-center gap-2 pl-5"
        aria-hidden="true"
      >
        <span class="size-4 rounded-xs bg-surface-3" />
        <span class="h-3 w-12 rounded-xs bg-surface-3" />
        <span class="size-3.5 rounded-full bg-surface-3" />
        <span class="h-3 rounded-xs bg-surface-3" :style="{ width: `${20 + ((i * 37) % 40)}%` }" />
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
      v-else-if="rows.length === 0 && filtered"
      :icon="ListFilter"
      title="No matching issues"
      description="Try a different search or remove some filters."
    >
      <Button variant="secondary" size="sm" @click="clearFilters">Clear filters</Button>
    </EmptyState>
    <template v-else-if="rows.length === 0">
      <slot name="empty">
        <EmptyState
          :icon="Layers"
          title="No issues yet"
          description="Create an issue to start tracking work."
        >
          <Button size="sm" @click="ui.openCreateIssue({ teamId, projectId })">New issue</Button>
        </EmptyState>
      </slot>
    </template>
    <div v-else ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto pt-2 pb-4" role="list">
      <div class="relative w-full" :style="{ height: `${virtualizer.getTotalSize()}px` }">
        <div
          v-for="{ item, row } in virtualRows"
          :key="row.key"
          class="absolute top-0 left-0 flex w-full items-center"
          :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
          role="listitem"
        >
          <div
            v-if="row.type === 'group'"
            class="mx-2 flex h-8 flex-1 items-center gap-1 rounded-md bg-group-band pr-1 pl-1"
          >
            <button
              type="button"
              class="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md pl-1 text-left"
              :aria-expanded="!collapsed.has(row.group.key)"
              @click="toggleGroup(row.group.key)"
            >
              <ChevronDown
                class="size-3.5 shrink-0 text-ink-tertiary transition-transform"
                :class="{ '-rotate-90': collapsed.has(row.group.key) }"
                aria-hidden="true"
              />
              <StatusIcon :category="row.group.status.category" />
              <span class="font-medium text-ink">{{ row.group.status.name }}</span>
              <span class="text-ink-subtle tabular-nums">{{ row.group.issues.length }}</span>
            </button>
            <Button
              v-if="teamId"
              variant="ghost"
              size="icon-xs"
              :aria-label="`New issue in ${row.group.status.name}`"
              @click="ui.openCreateIssue({ teamId, projectId, statusId: row.group.status.id })"
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
          <IssueRow
            v-else
            class="flex-1"
            :issue="row.issue"
            :depth="row.depth"
            :statuses="statusesByTeam.get(row.issue.teamId) ?? []"
            :users="users"
            :labels="labels"
            @update="(patch) => updateIssue.mutate({ issue: row.issue, patch })"
          />
        </div>
      </div>
    </div>
  </div>
</template>
