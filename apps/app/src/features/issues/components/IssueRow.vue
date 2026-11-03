<script setup lang="ts">
import type { Cycle, Issue, Label, WorkflowStatus } from '@linear/contract'
import { computed } from 'vue'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import CyclePicker from '@/components/common/CyclePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { assignableCycles } from '@/features/cycles/cycles'
import { toPriority } from '@/lib/priorities'
import type { IssuePatch } from '../issue-cache'

const props = defineProps<{
  issue: Issue
  /** The issue team's statuses; until they load, status shows read-only. */
  statuses: WorkflowStatus[]
  users: AssigneeOption[]
  labels: Label[]
  /** The issue team's cycles; empty when the team has cycles off. */
  cycles?: Cycle[]
}>()
const emit = defineEmits<{ update: [patch: IssuePatch] }>()

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
function setAssignee(assigneeId: string | null) {
  if (assigneeId !== props.issue.assigneeId) emit('update', { assigneeId })
}
function setLabels(ids: string[]) {
  const byId = new Map(labelOptions.value.map((l) => [l.id, l]))
  emit('update', { labels: ids.flatMap((id) => byId.get(id) ?? []) })
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
</script>

<template>
  <!-- The title link stretches over the whole row; the pickers sit above it. -->
  <div
    class="relative mx-2 flex h-full items-center gap-1 rounded-md pr-3 pl-3.5 outline-hidden hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring [&_button]:relative [&_button]:z-10"
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
    >
      {{ issue.title }}
    </RouterLink>
    <span v-if="issue.labels.length" class="hidden shrink-0 md:flex">
      <LabelPicker
        compact
        :labels="labelOptions"
        :model-value="labelIds"
        @update:model-value="setLabels"
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
