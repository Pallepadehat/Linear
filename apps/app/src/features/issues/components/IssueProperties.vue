<script setup lang="ts">
import type { Cycle, Issue, Label, LinkedPullRequest, WorkflowStatus } from '@linear/contract'
import { computed } from 'vue'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import CyclePicker from '@/components/common/CyclePicker.vue'
import EstimatePicker from '@/components/common/EstimatePicker.vue'
import DueDatePicker from '@/components/common/DueDatePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import ProjectPicker, { type ProjectOption } from '@/components/common/ProjectPicker.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { assignableCycles } from '@/features/cycles/cycles'
import type { EstimateSettings } from '@/lib/estimates'
import LinkedPullRequests from '@/features/github/components/LinkedPullRequests.vue'
import { toPriority, type Priority } from '@/lib/priorities'
import { fullDate, timeAgo } from '@/lib/relative-time'
import type { IssuePatch } from '../issue-cache'
import SubscribersPicker from './SubscribersPicker.vue'

const props = defineProps<{
  issue: Issue
  statuses: WorkflowStatus[]
  users: AssigneeOption[]
  labels: Label[]
  projects: ProjectOption[]
  /** The team's cycles; the Cycle section only shows when the team has cycles on. */
  cycles?: Cycle[]
  cyclesEnabled?: boolean
  /** The issue team's estimate scale; the picker is hidden while unknown or off. */
  estimates?: EstimateSettings | null
  /** Undefined while loading. */
  pullRequests: LinkedPullRequest[] | undefined
  subscribers: AssigneeOption[]
}>()
const emit = defineEmits<{
  change: [patch: IssuePatch]
  subscription: [user: AssigneeOption, subscribe: boolean]
}>()

const statusId = computed({
  get: () => props.issue.status.id,
  set: (id: string) => {
    const status = props.statuses.find((s) => s.id === id)
    if (status && status.id !== props.issue.status.id) emit('change', { status })
  },
})
const priority = computed({
  get: () => toPriority(props.issue.priority),
  set: (value: Priority) => {
    if (value !== props.issue.priority) emit('change', { priority: value })
  },
})
const assigneeId = computed({
  get: () => props.issue.assigneeId,
  set: (id: string | null) => {
    if (id !== props.issue.assigneeId) emit('change', { assigneeId: id })
  },
})
const dueDate = computed({
  get: () => props.issue.dueDate,
  set: (value: string | null) => {
    if (value !== props.issue.dueDate) emit('change', { dueDate: value })
  },
})
const labelIds = computed(() => props.issue.labels.map((l) => l.id))
// The issue's own labels stay pickable even if the workspace list hasn't loaded.
const labelOptions = computed(() => {
  const known = new Set(props.labels.map((l) => l.id))
  return [...props.labels, ...props.issue.labels.filter((l) => !known.has(l.id))]
})
const estimate = computed({
  get: () => props.issue.estimate,
  set: (value: number | null) => {
    if (value !== props.issue.estimate) emit('change', { estimate: value })
  },
})
function setLabels(labels: Label[]) {
  emit('change', { labels })
}
const projectId = computed({
  get: () => props.issue.projectId,
  set: (id: string | null) => {
    if (id !== props.issue.projectId) emit('change', { projectId: id })
  },
})
const cycleOptions = computed(() => assignableCycles(props.cycles ?? []))
const issueCycle = computed(() => props.cycles?.find((c) => c.id === props.issue.cycleId) ?? null)
const cycleId = computed({
  get: () => props.issue.cycleId,
  set: (id: string | null) => {
    if (id !== props.issue.cycleId) emit('change', { cycleId: id })
  },
})
</script>

<template>
  <aside
    aria-label="Issue properties"
    class="grid content-start gap-5 border-hairline px-4 py-4 text-[13px] lg:border-l"
  >
    <section class="grid gap-0.5">
      <h2 class="mb-1 px-2 text-xs font-medium text-ink-subtle">Properties</h2>
      <StatusPicker v-model="statusId" :statuses="statuses" />
      <PriorityPicker v-model="priority" />
      <AssigneePicker v-model="assigneeId" :users="users" />
      <EstimatePicker
        v-if="estimates && estimates.scale !== 'off'"
        v-model="estimate"
        :scale="estimates.scale"
        :allow-zero="estimates.allowZero"
      />
      <DueDatePicker v-model="dueDate" :category="issue.status.category" />
    </section>
    <section class="grid gap-1">
      <h2 class="px-2 text-xs font-medium text-ink-subtle">Labels</h2>
      <ul v-if="issue.labels.length" class="flex flex-wrap gap-1 px-2">
        <li
          v-for="label in issue.labels"
          :key="label.id"
          class="flex h-[22px] max-w-40 items-center gap-1.5 rounded-full border border-hairline px-2 text-xs text-ink-muted"
        >
          <!-- The label's own color is user data, not a design token. -->
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ backgroundColor: label.color }"
            aria-hidden="true"
          />
          <span class="truncate">{{ label.name }}</span>
        </li>
      </ul>
      <LabelPicker
        :model-value="labelIds"
        :labels="labelOptions"
        :team-id="issue.teamId"
        trigger-text="Add label"
        @update:labels="setLabels"
      />
    </section>
    <section class="grid gap-1">
      <h2 class="px-2 text-xs font-medium text-ink-subtle">Project</h2>
      <ProjectPicker v-model="projectId" :projects="projects" />
    </section>
    <section v-if="cyclesEnabled || issue.cycleId" class="grid gap-1">
      <h2 class="px-2 text-xs font-medium text-ink-subtle">Cycle</h2>
      <CyclePicker v-model="cycleId" :cycles="cycleOptions" :selected="issueCycle" />
    </section>
    <section class="grid gap-1">
      <h2 class="px-2 text-xs font-medium text-ink-subtle">Subscribers</h2>
      <SubscribersPicker
        :subscribers="subscribers"
        :members="users"
        @toggle="(user, subscribe) => emit('subscription', user, subscribe)"
      />
    </section>
    <!-- Filled in by M4-07 (linked PRs). -->
    <section class="grid gap-1">
      <h2 class="px-2 text-xs font-medium text-ink-subtle">Linked pull requests</h2>
      <LinkedPullRequests :pull-requests="pullRequests" />
    </section>
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 text-xs text-ink-subtle">
      <dt>Created</dt>
      <dd>
        <time :datetime="issue.createdAt.toISOString()" :title="fullDate(issue.createdAt)">
          {{ timeAgo(issue.createdAt) }}
        </time>
      </dd>
      <dt>Updated</dt>
      <dd>
        <time :datetime="issue.updatedAt.toISOString()" :title="fullDate(issue.updatedAt)">
          {{ timeAgo(issue.updatedAt) }}
        </time>
      </dd>
    </dl>
  </aside>
</template>
