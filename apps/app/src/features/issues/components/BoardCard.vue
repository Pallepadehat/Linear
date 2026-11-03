<script setup lang="ts">
import type { Issue, Label, WorkflowStatus } from '@linear/contract'
import { computed } from 'vue'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { toPriority } from '@/lib/priorities'
import type { IssuePatch } from '../issue-cache'

const props = defineProps<{
  issue: Issue
  /** The issue team's statuses; until they load, status shows read-only. */
  statuses: WorkflowStatus[]
  users: AssigneeOption[]
  labels: Label[]
  dragging?: boolean
}>()
const emit = defineEmits<{
  update: [patch: IssuePatch]
  dragstart: [event: DragEvent]
  dragend: []
}>()

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
function setAssignee(assigneeId: string | null) {
  if (assigneeId !== props.issue.assigneeId) emit('update', { assigneeId })
}
function setLabels(labels: Label[]) {
  emit('update', { labels })
}
</script>

<template>
  <article
    draggable="true"
    :aria-label="`${issue.identifier} ${issue.title}`"
    class="relative flex cursor-grab flex-col gap-1 rounded-lg border border-hairline bg-board-card py-2 pr-2 pl-3 shadow-panel transition-opacity hover:border-hairline-strong active:cursor-grabbing has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring [&_button]:relative [&_button]:z-10"
    :class="{ 'opacity-40': dragging }"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <div class="flex h-6 items-center gap-2">
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
    >
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
