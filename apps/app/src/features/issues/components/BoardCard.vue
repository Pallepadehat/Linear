<script setup lang="ts">
import type { Issue, Label, WorkflowStatus } from '@linear/contract'
import { computed } from 'vue'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import EstimatePicker from '@/components/common/EstimatePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import type { EstimateSettings } from '@/lib/estimates'
import { toPriority } from '@/lib/priorities'
import type { IssuePatch } from '../issue-cache'
import SelectionCheckbox from './SelectionCheckbox.vue'

const props = defineProps<{
  issue: Issue
  /** The issue team's statuses; until they load, status shows read-only. */
  statuses: WorkflowStatus[]
  users: AssigneeOption[]
  labels: Label[]
  /** The issue team's estimate scale; no chip while unknown or off. */
  estimates?: EstimateSettings
  dragging?: boolean
  /** In the bulk selection. */
  selected?: boolean
}>()
const emit = defineEmits<{
  update: [patch: IssuePatch]
  dragstart: [event: DragEvent]
  dragend: []
  /** The issue link was followed, so the board can hand the detail page its prev/next context. */
  open: []
  /** Checkbox, shift- or ⌘/Ctrl-click: toggle or extend the bulk selection. */
  select: [event: MouseEvent]
}>()

function onLinkClick(event: MouseEvent) {
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    event.preventDefault()
    emit('select', event)
  } else emit('open')
}

const labelIds = computed(() => props.issue.labels.map((l) => l.id))
const labelOptions = computed(() => (props.labels.length ? props.labels : props.issue.labels))

// The status picker doubles as the keyboard alternative to dragging: Tab to it,
// Enter, then pick the column to move to.
function setStatus(id: string) {
  const status = props.statuses.find((s) => s.id === id)
  if (status && status.id !== props.issue.status.id) emit('update', { status })
}
function setPriority(priority: number) {
  if (priority !== props.issue.priority) emit('update', { priority })
}
function setEstimate(estimate: number | null) {
  if (estimate !== props.issue.estimate) emit('update', { estimate })
}
function setAssignee(assigneeId: string | null) {
  if (assigneeId !== props.issue.assigneeId) emit('update', { assigneeId })
}
function setLabels(labels: Label[]) {
  emit('update', { labels })
}
</script>

<template>
  <article
    data-hotkey-scope
    :data-issue-id="issue.id"
    :data-selected="selected || undefined"
    draggable="true"
    :aria-label="`${issue.identifier} ${issue.title}`"
    class="group/card relative flex cursor-grab flex-col gap-1 rounded-lg border py-2 pr-2 pl-3 shadow-panel transition-opacity hover:border-hairline-strong active:cursor-grabbing has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring [&_button]:relative [&_button]:z-10"
    :class="[
      selected ? 'border-hairline-strong bg-surface-3' : 'border-hairline bg-board-card',
      { 'opacity-40': dragging },
    ]"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <div class="flex h-6 items-center gap-2">
      <SelectionCheckbox
        class="-ml-1 -mr-1.5"
        :class="selected ? 'flex' : 'hidden group-hover/card:flex group-focus-within/card:flex'"
        :checked="!!selected"
        :label="`Select ${issue.identifier}`"
        @toggle="emit('select', $event)"
      />
      <span class="min-w-0 flex-1 truncate font-mono text-xs text-ink-subtle">
        {{ issue.identifier }}
      </span>
      <AssigneePicker
        compact
        :users="users"
        :model-value="issue.assigneeId"
        @update:model-value="setAssignee"
      />
    </div>
    <!-- Stretched link: the whole card opens the issue; pickers sit above it. Not draggable so the card stays the drag source. -->
    <RouterLink
      :to="{ name: 'issue', params: { identifier: issue.identifier } }"
      draggable="false"
      class="line-clamp-2 cursor-[inherit] pr-1 font-medium break-words text-ink outline-hidden after:absolute after:inset-0 after:rounded-lg after:content-['']"
      @click="onLinkClick"
    >
      <span v-if="selected" class="sr-only">Selected,</span>
      {{ issue.title }}
    </RouterLink>
    <div class="-ml-1.5 flex flex-wrap items-center gap-0.5">
      <StatusPicker
        v-if="statuses.length"
        compact
        :statuses="statuses"
        :model-value="issue.status.id"
        @update:model-value="setStatus"
      />
      <template v-else>
        <span class="flex size-7 shrink-0 items-center justify-center">
          <StatusIcon :category="issue.status.category" />
        </span>
        <span class="sr-only">Status: {{ issue.status.name }}</span>
      </template>
      <PriorityPicker
        compact
        :model-value="toPriority(issue.priority)"
        @update:model-value="setPriority"
      />
      <EstimatePicker
        v-if="estimates && estimates.scale !== 'off'"
        compact
        :scale="estimates.scale"
        :allow-zero="estimates.allowZero"
        :model-value="issue.estimate"
        @update:model-value="setEstimate"
      />
      <LabelPicker
        v-if="issue.labels.length"
        compact
        :labels="labelOptions"
        :team-id="issue.teamId"
        :model-value="labelIds"
        @update:labels="setLabels"
      />
    </div>
  </article>
</template>
