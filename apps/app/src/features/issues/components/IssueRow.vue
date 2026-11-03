<script setup lang="ts">
import type { Issue, Label, WorkflowStatus } from '@linear/contract'
import { Ban, OctagonAlert } from '@lucide/vue'
import { computed } from 'vue'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import DueDatePicker from '@/components/common/DueDatePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { toPriority } from '@/lib/priorities'
import type { IssuePatch } from '../issue-cache'
import SubIssueProgressRing from './SubIssueProgressRing.vue'

const props = defineProps<{
  issue: Issue
  /** The issue team's statuses; until they load, status shows read-only. */
  statuses: WorkflowStatus[]
  users: AssigneeOption[]
  labels: Label[]
  /** Nesting level when shown under its parent (each level indents the row). */
  depth?: number
  /** Keyboard focus (J/K) and selection (X); see `useIssueListKeyboard`. */
  focused?: boolean
  selected?: boolean
}>()
const emit = defineEmits<{
  update: [patch: IssuePatch]
  /** The issue link was followed, so the list can hand the detail page its prev/next context. */
  open: []
}>()

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
    class="relative mx-2 flex h-full items-center gap-1 rounded-md pr-3 pl-3.5 outline-hidden hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring [&_button]:relative [&_button]:z-10"
    :class="{ 'bg-surface-2': focused && !selected, 'bg-surface-3': selected }"
    :data-focused="focused || undefined"
    :data-selected="selected || undefined"
  >
    <PriorityPicker
      compact
      :model-value="toPriority(issue.priority)"
      @update:model-value="setPriority"
    />
    <span class="ml-1 w-16 shrink-0 truncate font-mono text-xs text-ink-subtle">
      {{ issue.identifier }}
    </span>
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
    <RouterLink
      :to="{ name: 'issue', params: { identifier: issue.identifier } }"
      class="ml-1 min-w-0 flex-1 truncate font-medium text-ink outline-hidden after:absolute after:inset-0 after:content-['']"
      @click="emit('open')"
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
    <span v-if="issue.labels.length" class="hidden shrink-0 md:flex">
      <LabelPicker
        compact
        :labels="labelOptions"
        :team-id="issue.teamId"
        :model-value="labelIds"
        @update:labels="setLabels"
      />
    </span>
    <DueDatePicker
      row
      :category="issue.status.category"
      :model-value="issue.dueDate"
      @update:model-value="setDueDate"
    />
    <AssigneePicker
      compact
      :users="users"
      :model-value="issue.assigneeId"
      @update:model-value="setAssignee"
    />
    <time
      :datetime="issue.createdAt.toISOString()"
      class="ml-1 hidden w-12 shrink-0 text-right text-xs text-ink-subtle tabular-nums sm:block"
    >
      {{ dateFormat.format(issue.createdAt) }}
    </time>
  </div>
</template>
