<script setup lang="ts">
import { Layers } from '@lucide/vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, ref, watchEffect } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Button } from '@/components/ui/button'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import { groupIssuesByStatus, toListRows } from '../group-issues'
import { issueListOptions } from '../queries'
import IssueRow from './IssueRow.vue'

const props = defineProps<{ workspaceSlug: string; teamId?: string }>()

const GROUP_HEIGHT = 36
const ROW_HEIGHT = 40
// Start loading the next page this many rows before the end.
const PREFETCH_ROWS = 20

const ui = useUiStore()
const query = useInfiniteQuery(
  computed(() => issueListOptions(props.workspaceSlug, props.teamId)),
)
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: props.workspaceSlug } }),
  ),
)

const membersById = computed(() => new Map(members.value?.map((m) => [m.userId, m])))
const issues = computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? [])
const rows = computed(() => toListRows(groupIssuesByStatus(issues.value)))

const scrollEl = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollEl.value,
    estimateSize: (index: number) =>
      rows.value[index]?.type === 'group' ? GROUP_HEIGHT : ROW_HEIGHT,
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

watchEffect(() => {
  const last = virtualRows.value.at(-1)
  if (!last || last.item.index < rows.value.length - PREFETCH_ROWS) return
  if (query.hasNextPage.value && !query.isFetchingNextPage.value) void query.fetchNextPage()
})
</script>

<template>
  <div v-if="query.isPending.value" class="grid" aria-busy="true" aria-label="Loading issues">
    <div
      v-for="i in 8"
      :key="i"
      class="flex h-10 items-center gap-3 border-b border-hairline px-6"
      aria-hidden="true"
    >
      <span class="size-4 rounded-xs bg-surface-2" />
      <span class="h-3 w-12 rounded-xs bg-surface-2" />
      <span class="h-3 rounded-xs bg-surface-2" :style="{ width: `${20 + ((i * 37) % 40)}%` }" />
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
    v-else-if="rows.length === 0"
    :icon="Layers"
    title="No issues yet"
    description="Create an issue to start tracking work."
  >
    <Button size="sm" @click="ui.openCreateIssue(teamId)">New issue</Button>
  </EmptyState>
  <div v-else ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto" role="list">
    <div class="relative w-full" :style="{ height: `${virtualizer.getTotalSize()}px` }">
      <div
        v-for="{ item, row } in virtualRows"
        :key="row.key"
        class="absolute top-0 left-0 w-full"
        :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
        role="listitem"
      >
        <div
          v-if="row.type === 'group'"
          class="flex h-full items-center gap-2 border-b border-hairline bg-surface-1 px-6"
        >
          <StatusIcon :category="row.group.status.category" />
          <span class="font-medium text-ink">{{ row.group.status.name }}</span>
          <span class="text-[13px] text-ink-subtle tabular-nums">{{ row.group.issues.length }}</span>
        </div>
        <IssueRow
          v-else
          :issue="row.issue"
          :assignee="row.issue.assigneeId ? membersById.get(row.issue.assigneeId) : undefined"
        />
      </div>
    </div>
  </div>
</template>
