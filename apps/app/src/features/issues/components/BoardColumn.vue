<script setup lang="ts">
import type { DisplayProperty, Issue, Label, WorkflowStatus } from '@linear/contract'
import { Plus } from '@lucide/vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, ref, useId, type ComponentPublicInstance } from 'vue'
import type { AssigneeOption } from '@/components/common/AssigneePicker.vue'
import EstimateIcon from '@/components/common/EstimateIcon.vue'
import IconButton from '@/components/common/IconButton.vue'
import { pointsText, sumEstimates, type EstimateSettings } from '@/lib/estimates'
import type { BoardColumn } from '../board-columns'
import type { IssuePatch } from '../issue-cache'
import { groupSelectionState } from '../selection'
import BoardCard from './BoardCard.vue'
import GroupIcon from './GroupIcon.vue'
import SelectionCheckbox from './SelectionCheckbox.vue'

const props = defineProps<{
  column: BoardColumn
  statusesByTeam: ReadonlyMap<string, WorkflowStatus[]>
  estimatesByTeam: ReadonlyMap<string, EstimateSettings>
  users: AssigneeOption[]
  labels: Label[]
  /** The card being dragged, if any. */
  draggingId: string | null
  /** Whether the dragged card may be dropped here. */
  canDrop: boolean
  /** Shows the `+` that creates an issue in this column. */
  creatable: boolean
  /** Display options → properties shown on the cards. */
  properties?: readonly DisplayProperty[]
  /** The bulk selection (see `useIssueSelection`). */
  selectedIds: ReadonlySet<string>
}>()
const emit = defineEmits<{
  update: [issue: Issue, patch: IssuePatch]
  dragstart: [issue: Issue, event: DragEvent]
  dragend: []
  drop: []
  create: []
  open: [issue: Issue]
  select: [issue: Issue, event: MouseEvent]
  selectAll: []
}>()

// Card height varies with the title (up to two lines) and labels; measured after render.
const ESTIMATED_CARD_HEIGHT = 104

const headingId = useId()
const selectionState = computed(() =>
  groupSelectionState(
    props.selectedIds,
    props.column.issues.map((issue) => issue.id),
  ),
)
// From the cached issues, so optimistic estimate changes show at once.
const estimateTotal = computed(() =>
  sumEstimates(props.column.issues, (teamId) => props.estimatesByTeam.get(teamId)?.scale),
)
const scrollEl = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.column.issues.length,
    getScrollElement: () => scrollEl.value,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    getItemKey: (index: number) => props.column.issues[index]?.id ?? index,
    overscan: 6,
  })),
)
const virtualCards = computed(() =>
  virtualizer.value.getVirtualItems().flatMap((item) => {
    const issue = props.column.issues[item.index]
    return issue ? [{ item, issue }] : []
  }),
)
function measure(el: Element | ComponentPublicInstance | null) {
  if (el instanceof Element) virtualizer.value.measureElement(el)
}

const over = ref(false)
const highlighted = computed(() => over.value && props.canDrop && props.draggingId !== null)

function onDragOver(event: DragEvent) {
  if (!props.draggingId || !props.canDrop) return
  // Accepting the drop is what lets it happen at all.
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  over.value = true
}
function onDragLeave(event: DragEvent) {
  const to = event.relatedTarget
  if (!(to instanceof Node) || !(event.currentTarget as HTMLElement).contains(to))
    over.value = false
}
function onDrop(event: DragEvent) {
  event.preventDefault()
  over.value = false
  emit('drop')
}
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex w-72 shrink-0 snap-start flex-col rounded-lg transition-colors md:w-80"
    :class="highlighted ? 'bg-surface-3' : 'bg-surface-1'"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <header class="group/header flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3">
      <SelectionCheckbox
        v-if="column.issues.length"
        class="-mx-1"
        :class="selectionState ? 'flex' : 'hidden group-hover/header:flex focus-visible:flex'"
        :checked="selectionState"
        :label="`Select all issues in ${column.label}`"
        @toggle="emit('selectAll')"
      />
      <GroupIcon
        :class="column.issues.length && !selectionState ? 'group-hover/header:hidden' : undefined"
        :icon="column.icon"
      />
      <h2 :id="headingId" class="truncate font-medium text-ink">{{ column.label }}</h2>
      <span class="text-ink-subtle tabular-nums">{{ column.issues.length }}</span>
      <span
        v-if="estimateTotal > 0"
        class="flex items-center gap-1 text-xs text-ink-subtle tabular-nums"
        :title="`Estimate: ${pointsText(estimateTotal)}`"
      >
        <EstimateIcon class="size-3.5" />
        {{ estimateTotal }}
        <span class="sr-only">{{ estimateTotal === 1 ? 'point' : 'points' }}</span>
      </span>
      <IconButton
        v-if="creatable"
        :icon="Plus"
        size="icon-xs"
        class="ml-auto"
        :label="`New issue in ${column.label}`"
        @click="emit('create')"
      />
    </header>
    <div ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto px-1.5">
      <div
        class="relative w-full"
        :style="{ height: `${virtualizer.getTotalSize()}px` }"
        role="list"
        :aria-labelledby="headingId"
      >
        <div
          v-for="{ item, issue } in virtualCards"
          :key="issue.id"
          :ref="measure"
          :data-index="item.index"
          class="absolute top-0 left-0 w-full pb-1.5"
          :style="{ transform: `translateY(${item.start}px)` }"
          role="listitem"
        >
          <BoardCard
            :issue="issue"
            :statuses="statusesByTeam.get(issue.teamId) ?? []"
            :users="users"
            :labels="labels"
            :estimates="estimatesByTeam.get(issue.teamId)"
            :dragging="draggingId === issue.id"
            :properties="properties"
            :selected="selectedIds.has(issue.id)"
            @update="(patch) => emit('update', issue, patch)"
            @dragstart="(event) => emit('dragstart', issue, event)"
            @dragend="emit('dragend')"
            @open="emit('open', issue)"
            @select="(event) => emit('select', issue, event)"
          />
        </div>
      </div>
    </div>
  </section>
</template>
