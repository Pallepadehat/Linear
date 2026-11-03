<script setup lang="ts">
import type { Cycle, DisplayProperty, Issue, Label, WorkflowStatus } from '@linear/contract'
import { Ban, OctagonAlert } from '@lucide/vue'
import { computed } from 'vue'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import CyclePicker from '@/components/common/CyclePicker.vue'
import EstimatePicker from '@/components/common/EstimatePicker.vue'
import DueDatePicker from '@/components/common/DueDatePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { assignableCycles } from '@/features/cycles/cycles'
import type { EstimateSettings } from '@/lib/estimates'
import { toPriority } from '@/lib/priorities'
import type { IssuePatch } from '../issue-cache'
import SelectionCheckbox from './SelectionCheckbox.vue'
import SubIssueProgressRing from './SubIssueProgressRing.vue'

const props = defineProps<{
  issue: Issue
  /** The issue team's statuses; until they load, status shows read-only. */
  statuses: WorkflowStatus[]
  users: AssigneeOption[]
  labels: Label[]
  /** The issue team's cycles; empty when the team has cycles off. */
  cycles?: Cycle[]
  /** The issue team's estimate scale; no chip while unknown or off. */
  estimates?: EstimateSettings
  /** Nesting level when shown under its parent (each level indents the row). */
  depth?: number
  /** Keyboard focus (J/K) and selection (X); see `useIssueListKeyboard`. */
  focused?: boolean
  selected?: boolean
  /** Display options → properties; all are shown when not given. */
  properties?: readonly DisplayProperty[]
}>()
const emit = defineEmits<{
  update: [patch: IssuePatch]
  /** The issue link was followed, so the list can hand the detail page its prev/next context. */
  open: []
  /** Checkbox, shift- or ⌘/Ctrl-click: toggle or extend the bulk selection. */
  select: [event: MouseEvent]
}>()

const shows = (property: DisplayProperty) =>
  !props.properties || props.properties.includes(property)

function onLinkClick(event: MouseEvent) {
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    event.preventDefault()
    emit('select', event)
  } else emit('open')
}

const cycleOptions = computed(() => assignableCycles(props.cycles ?? []))
const issueCycle = computed(() => props.cycles?.find((c) => c.id === props.issue.cycleId) ?? null)
function setCycle(cycleId: string | null) {
  if (cycleId !== props.issue.cycleId) emit('update', { cycleId })
}

const labelIds = computed(() => props.issue.labels.map((l) => l.id))
// The issue's own labels stay pickable even if the workspace list hasn't loaded.
const labelOptions = computed(() => (props.labels.length ? props.labels : props.issue.labels))

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
function setDueDate(dueDate: string | null) {
  if (dueDate !== props.issue.dueDate) emit('update', { dueDate })
}
function setLabels(labels: Label[]) {
  emit('update', { labels })
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
</script>

<template>
  <!-- The title link stretches over the whole row; the pickers sit above it. Their
       hotkeys (⇧D, P, …) act on this row while focus is in it. -->
  <div
    :style="depth ? { paddingLeft: `${14 + depth * 24}px` } : undefined"
    data-hotkey-scope
    class="group/row relative mx-2 flex h-full items-center gap-1 rounded-md pr-3 pl-3.5 outline-hidden hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring [&_button]:relative [&_button]:z-10"
    :class="{ 'bg-surface-2': focused && !selected, 'bg-surface-3': selected }"
    :data-focused="focused || undefined"
    :data-selected="selected || undefined"
  >
    <SelectionCheckbox
      class="absolute! top-1/2 left-0 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
      :class="{ 'opacity-100': selected }"
      :checked="!!selected"
      :label="`Select ${issue.identifier}`"
      @toggle="emit('select', $event)"
    />
    <PriorityPicker
      v-if="shows('priority')"
      compact
      :model-value="toPriority(issue.priority)"
      @update:model-value="setPriority"
    />
    <span v-if="shows('id')" class="ml-1 w-16 shrink-0 truncate font-mono text-xs text-ink-subtle">
      {{ issue.identifier }}
    </span>
    <template v-if="!shows('status')" />
    <StatusPicker
      v-else-if="statuses.length"
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
    <RouterLink
      :to="{ name: 'issue', params: { identifier: issue.identifier } }"
      class="ml-1 min-w-0 flex-1 truncate font-medium text-ink outline-hidden after:absolute after:inset-0 after:content-['']"
      @click="onLinkClick"
    >
      <span v-if="selected" class="sr-only">Selected,</span>
      {{ issue.title }}
    </RouterLink>
    <span
      v-if="issue.subIssueProgress?.total"
      class="flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2 text-xs text-ink-subtle tabular-nums"
    >
      <SubIssueProgressRing v-bind="issue.subIssueProgress" />
      {{ issue.subIssueProgress.done }}/{{ issue.subIssueProgress.total }}
      <span class="sr-only">sub-issues done</span>
    </span>
    <span
      v-if="issue.blockedByCount"
      class="flex shrink-0 items-center gap-1 text-xs text-priority-urgent tabular-nums"
      :title="`Blocked by ${issue.blockedByCount} ${issue.blockedByCount === 1 ? 'issue' : 'issues'}`"
    >
      <Ban class="size-3.5" aria-hidden="true" />
      <span class="sr-only">Blocked by</span>
      {{ issue.blockedByCount }}
    </span>
    <span
      v-if="issue.blockingCount"
      class="flex shrink-0 items-center gap-1 text-xs text-ink-subtle tabular-nums"
      :title="`Blocking ${issue.blockingCount} ${issue.blockingCount === 1 ? 'issue' : 'issues'}`"
    >
      <OctagonAlert class="size-3.5" aria-hidden="true" />
      <span class="sr-only">Blocking</span>
      {{ issue.blockingCount }}
    </span>
    <span v-if="shows('labels') && issue.labels.length" class="hidden shrink-0 md:flex">
      <LabelPicker
        compact
        :labels="labelOptions"
        :team-id="issue.teamId"
        :model-value="labelIds"
        @update:labels="setLabels"
      />
    </span>
    <span v-if="issueCycle" class="hidden shrink-0 md:flex">
      <CyclePicker
        compact
        :cycles="cycleOptions"
        :selected="issueCycle"
        :model-value="issue.cycleId"
        @update:model-value="setCycle"
      />
    </span>
    <EstimatePicker
      v-if="shows('estimate') && estimates && estimates.scale !== 'off'"
      compact
      :scale="estimates.scale"
      :allow-zero="estimates.allowZero"
      :model-value="issue.estimate"
      @update:model-value="setEstimate"
    />
    <DueDatePicker
      v-if="shows('dueDate')"
      row
      :category="issue.status.category"
      :model-value="issue.dueDate"
      @update:model-value="setDueDate"
    />
    <AssigneePicker
      v-if="shows('assignee')"
      compact
      :users="users"
      :model-value="issue.assigneeId"
      @update:model-value="setAssignee"
    />
    <time
      v-if="shows('updatedAt')"
      :datetime="issue.updatedAt.toISOString()"
      :title="`Updated ${dateFormat.format(issue.updatedAt)}`"
      class="ml-1 hidden w-12 shrink-0 text-right text-xs text-ink-subtle tabular-nums sm:block"
    >
      {{ dateFormat.format(issue.updatedAt) }}
    </time>
    <time
      v-if="shows('createdAt')"
      :datetime="issue.createdAt.toISOString()"
      :title="`Created ${dateFormat.format(issue.createdAt)}`"
      class="ml-1 hidden w-12 shrink-0 text-right text-xs text-ink-subtle tabular-nums sm:block"
    >
      {{ dateFormat.format(issue.createdAt) }}
    </time>
  </div>
</template>
