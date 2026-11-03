<script setup lang="ts">
import type { Issue } from '@linear/contract'
import { ChevronDown, Layers, ListFilter, Plus } from '@lucide/vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import EstimateIcon from '@/components/common/EstimateIcon.vue'
import { Button } from '@/components/ui/button'
import { pointsText, sumEstimates } from '@/lib/estimates'
import { useIssueNavStore } from '@/stores/issue-nav'
import { useUiStore } from '@/stores/ui'
import { useDisplayOptions } from '../composables/useDisplayOptions'
import { useIssueFilters } from '../composables/useIssueFilters'
import {
  displayListInput,
  displayViewKey,
  effectiveSubGrouping,
  visibleCategories,
} from '../display-options'
import {
  groupIssues,
  listOrder,
  toListRows,
  uniqueIssues,
  type IssueGroup,
  type IssueListRow,
} from '../group-issues'
import { useIssueListKeyboard } from '../composables/useIssueListKeyboard'
import { useIssueSelection } from '../composables/useIssueSelection'
import { useIssueViewData } from '../composables/useIssueViewData'
import { viewStatusCategories } from '../issue-view'
import GroupIcon from './GroupIcon.vue'
import BulkActionBar from './BulkActionBar.vue'
import IssueFilterBar from './IssueFilterBar.vue'
import IssueRow from './IssueRow.vue'
import SelectionCheckbox from './SelectionCheckbox.vue'

// Spelled out: Vue's SFC compiler can't resolve the zod-inferred `IssueListFilter` for props.
const props = defineProps<{
  workspaceSlug: string
  teamId?: string
  projectId?: string
  cycleId?: string
  assignee?: 'me'
  creator?: 'me'
  /** The view tab (team and All issues pages); My issues and project lists have none. */
  view?: 'all' | 'active' | 'backlog'
}>()
// Replaces the default "No issues yet" state, e.g. for My Issues tabs.
defineSlots<{ empty?: () => unknown }>()

const GROUP_HEIGHT = 40
const ROW_HEIGHT = 36
// Start loading the next page this many rows before the end.
const PREFETCH_ROWS = 20

const ui = useUiStore()
const { filters, active: filtered, clear: clearFilters } = useIssueFilters()
const viewKey = computed(() => displayViewKey(props))
const { options } = useDisplayOptions(viewKey)
const {
  query,
  queryKey,
  issues,
  users,
  labels,
  projects,
  statusesByTeam,
  cyclesByTeam,
  estimatesByTeam,
  updateIssue,
} = useIssueViewData(
  () => props.workspaceSlug,
  () => ({
    teamId: props.teamId,
    projectId: props.projectId,
    cycleId: props.cycleId,
    assignee: props.assignee,
    creator: props.creator,
    ...displayListInput(options.value, viewStatusCategories(props.view)),
  }),
)
const properties = computed(() => options.value.properties)
const viewEmpty = computed(() =>
  props.view === 'active'
    ? { title: 'No active issues', description: 'Issues in Todo or In Progress show up here.' }
    : props.view === 'backlog'
      ? { title: 'No backlog issues', description: 'Issues waiting in the backlog show up here.' }
      : null,
)
const collapsed = ref(new Set<string>())
// Sums come from the cached issues, so optimistic estimate changes show at once.
const groupEstimate = (group: IssueGroup) =>
  sumEstimates(group.issues, (teamId) => estimatesByTeam.value.get(teamId)?.scale)
// Grouping runs on the loaded pages, in the app (domain.md → Display options).
const group = (list: Issue[]) =>
  groupIssues(
    list,
    {
      groupBy: options.value.grouping,
      subGroupBy: effectiveSubGrouping(options.value),
      direction: options.value.groupDirection,
      showEmpty: options.value.showEmptyGroups,
      ordering: { completedByRecency: options.value.orderCompletedByRecency },
    },
    {
      statusesByTeam: statusesByTeam.value,
      categories: visibleCategories(options.value, viewStatusCategories(props.view)),
      users: users.value,
      projects: projects.value,
      labels: labels.value,
    },
  )
const groups = computed(() => group(issues.value))
const rows = computed(() => toListRows(groups.value, collapsed.value))
// Empty groups alone ("Show empty groups") still mean an empty list.
const hasIssues = computed(() => rows.value.some((row) => row.type === 'issue'))
const hasGroups = computed(() => issues.value.length > 0 || rows.value.length > 0)

// The "+" on a group header creates an issue with that group's value.
function createInGroup(target: IssueGroup) {
  const base = { teamId: props.teamId, projectId: props.projectId, cycleId: props.cycleId }
  const value = target.value
  if (value.by === 'status') ui.openCreateIssue({ ...base, statusId: value.status.id })
  else if (value.by === 'assignee')
    ui.openCreateIssue({ ...base, assigneeId: value.assigneeId ?? undefined })
  else if (value.by === 'project')
    ui.openCreateIssue({ ...base, projectId: value.projectId ?? base.projectId })
  else ui.openCreateIssue(base)
}

function toggleGroup(key: string) {
  const next = new Set(collapsed.value)
  if (!next.delete(key)) next.add(key)
  collapsed.value = next
}

// The detail page steps through the issues in the order shown here (J/K, "1 / 47").
const router = useRouter()
const nav = useIssueNavStore()
function openIssue(issue: Issue) {
  const hidden = new Set(collapsed.value)
  const order = (list: Issue[]) => listOrder(group(list), hidden)
  nav.open(
    {
      queryKey: queryKey.value,
      identifiers: order(issues.value),
      order,
      route: router.currentRoute.value.fullPath,
    },
    issue.identifier,
  )
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

// A new filter, sort, grouping or view is a different list; start it from the top.
watch([filters, () => props.view, options], () => {
  if (scrollEl.value) scrollEl.value.scrollTop = 0
})

// J/K move through the visible rows (collapsed groups are skipped); an issue
// listed under several labels is visited once.
const listedIssues = computed(() => uniqueIssues(rows.value))
const {
  selectedIds,
  click: select,
  groupState,
  toggleGroup: toggleGroupSelection,
} = useIssueSelection(listedIssues, { loaded: issues })
const { focusedId } = useIssueListKeyboard(listedIssues, async (issue) => {
  const index = rows.value.findIndex((row) => row.type === 'issue' && row.issue.id === issue.id)
  if (index === -1) return
  virtualizer.value.scrollToIndex(index, { align: 'auto' })
  // The row may only render after the scroll; then move focus to its link.
  await nextTick()
  requestAnimationFrame(() =>
    scrollEl.value
      ?.querySelector<HTMLElement>(`[data-issue-id="${issue.id}"] a`)
      ?.focus({ preventScroll: true }),
  )
})

watchEffect(() => {
  const last = virtualRows.value.at(-1)
  if (!last || last.item.index < rows.value.length - PREFETCH_ROWS) return
  if (query.hasNextPage.value && !query.isFetchingNextPage.value) void query.fetchNextPage()
})
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <IssueFilterBar
      :workspace-slug="workspaceSlug"
      :team-id="teamId"
      :project-id="projectId"
      :cycle-id="cycleId"
      :assignee="assignee"
      :creator="creator"
      :hide-filter-menu="!!view"
    />
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
      v-else-if="!hasIssues && filtered"
      :icon="ListFilter"
      title="No matching issues"
      description="Try a different search or remove some filters."
    >
      <Button variant="secondary" size="sm" @click="clearFilters">Clear filters</Button>
    </EmptyState>
    <EmptyState
      v-else-if="!hasIssues && viewEmpty"
      :icon="Layers"
      :title="viewEmpty.title"
      :description="viewEmpty.description"
    >
      <Button size="sm" @click="ui.openCreateIssue({ teamId, projectId })">New issue</Button>
    </EmptyState>
    <template v-else-if="!hasGroups">
      <slot name="empty">
        <EmptyState
          :icon="Layers"
          title="No issues yet"
          description="Create an issue to start tracking work."
        >
          <Button size="sm" @click="ui.openCreateIssue({ teamId, projectId, cycleId })"
            >New issue</Button
          >
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
            class="group/band mx-2 flex h-8 flex-1 items-center gap-1 rounded-md pr-1"
            :class="row.depth ? 'pl-6' : 'bg-group-band pl-1'"
          >
            <SelectionCheckbox
              class="opacity-0 group-hover/band:opacity-100 focus-visible:opacity-100"
              :class="{ 'opacity-100': groupState(row.group.issues) }"
              :checked="groupState(row.group.issues)"
              :label="`Select all issues in ${row.group.label}`"
              @toggle="toggleGroupSelection(row.group.issues)"
            />
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
              <GroupIcon :icon="row.group.icon" />
              <span class="truncate font-medium text-ink">{{ row.group.label }}</span>
              <span class="text-ink-subtle tabular-nums">{{ row.group.issues.length }}</span>
              <span
                v-if="groupEstimate(row.group) > 0"
                class="ml-1 flex items-center gap-1 text-xs text-ink-subtle tabular-nums"
                :title="`Estimate: ${pointsText(groupEstimate(row.group))}`"
              >
                <EstimateIcon class="size-3.5" />
                {{ groupEstimate(row.group) }}
                <span class="sr-only">{{
                  groupEstimate(row.group) === 1 ? 'point' : 'points'
                }}</span>
              </span>
            </button>
            <Button
              v-if="teamId && !row.depth"
              variant="ghost"
              size="icon-xs"
              :aria-label="`New issue in ${row.group.label}`"
              @click="createInGroup(row.group)"
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
          <IssueRow
            v-else
            class="flex-1"
            :issue="row.issue"
            :depth="row.depth"
            :data-issue-id="row.issue.id"
            :focused="row.issue.id === focusedId"
            :selected="selectedIds.has(row.issue.id)"
            :statuses="statusesByTeam.get(row.issue.teamId) ?? []"
            :cycles="cyclesByTeam.get(row.issue.teamId) ?? []"
            :users="users"
            :labels="labels"
            :estimates="estimatesByTeam.get(row.issue.teamId)"
            :properties="properties"
            @update="(patch) => updateIssue.mutate({ issue: row.issue, patch })"
            @open="openIssue(row.issue)"
            @select="(event) => select(row.issue, event)"
          />
        </div>
      </div>
    </div>
    <BulkActionBar
      :workspace-slug="workspaceSlug"
      :issues="issues"
      :statuses-by-team="statusesByTeam"
      :users="users"
      :labels="labels"
    />
  </div>
</template>
