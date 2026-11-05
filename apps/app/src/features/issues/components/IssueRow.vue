<script setup lang="ts">
import type { Cycle, DisplayProperty, Issue, Label, WorkflowStatus } from '@linear/contract'
import { Ban, Link2, OctagonAlert } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import CyclePicker from '@/components/common/CyclePicker.vue'
import EstimatePicker from '@/components/common/EstimatePicker.vue'
import DueDatePicker from '@/components/common/DueDatePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import MilestoneIcon from '@/components/common/MilestoneIcon.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import ProjectPicker, { type ProjectOption } from '@/components/common/ProjectPicker.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { assignableCycles } from '@/features/cycles/cycles'
import PullRequestIcon from '@/features/github/components/PullRequestIcon.vue'
import { pullRequestStates } from '@/features/github/pull-requests'
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
  /** Workspace projects (names and icons); the issue's own summary stands in until they load. */
  projects?: ProjectOption[]
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

const issueRoute = computed(() => ({
  name: 'issue',
  params: { identifier: props.issue.identifier },
}))

function onLinkClick(event: MouseEvent) {
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    event.preventDefault()
    emit('select', event)
  } else emit('open')
}

// Read-only chips sit above the row link (for their `title` tooltips), so they open the issue
// themselves, like a click anywhere else on the row.
const router = useRouter()
function onChipClick(event: MouseEvent) {
  if (event.shiftKey || event.metaKey || event.ctrlKey) return emit('select', event)
  emit('open')
  void router.push(issueRoute.value)
}

const projectOptions = computed<ProjectOption[]>(() => {
  if (props.projects?.length) return props.projects
  const { project } = props.issue
  return project ? [{ id: project.id, name: project.name, iconUrl: null }] : []
})
function setProject(projectId: string | null) {
  if (projectId !== props.issue.projectId) emit('update', { projectId })
}

const pullRequestSummary = computed(() =>
  props.issue.pullRequests
    .map((pr) => `#${pr.number} ${pullRequestStates[pr.state].label.toLowerCase()}`)
    .join(', '),
)

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
const fullDateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' })
</script>

<template>
  <!-- The title link stretches over the whole row; the pickers sit above it. Their
       hotkeys (⇧D, P, …) act on this row while focus is in it. -->
  <div
    :style="depth ? { paddingLeft: `${28 + depth * 24}px` } : undefined"
    data-hotkey-scope
    class="group/row relative mx-2 flex h-full min-w-0 items-center gap-1 rounded-md pr-3 pl-7 outline-hidden hover:bg-surface-2 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring [&_button]:relative [&_button]:z-10"
    :class="{ 'bg-surface-2': focused && !selected, 'bg-surface-3': selected }"
    :data-focused="focused || undefined"
    :data-selected="selected || undefined"
  >
    <SelectionCheckbox
      class="absolute! top-1/2 left-1 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
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
    <span
      v-if="shows('id')"
      class="ml-1 w-14 shrink-0 truncate font-mono text-xs text-ink-subtle md:w-16"
    >
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
    <!-- The title keeps at least 8rem; past that the chip group clips from its start
         edge (justify-end + overflow-hidden), as in Linear. -->
    <RouterLink
      :to="issueRoute"
      class="ml-1 min-w-0 flex-[1_1_0%] truncate font-medium text-ink md:min-w-32 outline-hidden after:absolute after:inset-0 after:content-['']"
      @click="onLinkClick"
    >
      <span v-if="selected" class="sr-only">Selected,</span>
      {{ issue.title }}
    </RouterLink>
    <!-- Secondary chips; phones keep only priority, ID, status, title and assignee. -->
    <div
      class="flex min-w-0 items-center justify-end gap-1 self-stretch overflow-hidden pl-2 max-md:hidden"
    >
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
        class="relative z-10 flex shrink-0 cursor-default items-center gap-1 text-xs text-priority-urgent tabular-nums"
        :title="`Blocked by ${issue.blockedByCount} ${issue.blockedByCount === 1 ? 'issue' : 'issues'}`"
        @click="onChipClick"
      >
        <Ban class="size-3.5" aria-hidden="true" />
        <span class="sr-only">Blocked by</span>
        {{ issue.blockedByCount }}
      </span>
      <span
        v-if="issue.blockingCount"
        class="relative z-10 flex shrink-0 cursor-default items-center gap-1 text-xs text-ink-subtle tabular-nums"
        :title="`Blocking ${issue.blockingCount} ${issue.blockingCount === 1 ? 'issue' : 'issues'}`"
        @click="onChipClick"
      >
        <OctagonAlert class="size-3.5" aria-hidden="true" />
        <span class="sr-only">Blocking</span>
        {{ issue.blockingCount }}
      </span>
      <span v-if="shows('labels') && issue.labels.length" class="flex shrink-0">
        <LabelPicker
          compact
          :labels="labelOptions"
          :team-id="issue.teamId"
          :model-value="labelIds"
          @update:labels="setLabels"
        />
      </span>
      <span v-if="shows('project') && issue.projectId" class="flex shrink-0">
        <ProjectPicker
          row
          :projects="projectOptions"
          :model-value="issue.projectId"
          @update:model-value="setProject"
        />
      </span>
      <span
        v-if="shows('milestone') && issue.milestone"
        :title="`Milestone: ${issue.milestone.name}`"
        class="relative z-10 flex h-6 max-w-40 shrink-0 cursor-default items-center gap-1.5 rounded-full border border-hairline px-2 text-xs text-ink-muted"
        @click="onChipClick"
      >
        <MilestoneIcon :progress="0" />
        <span class="truncate">{{ issue.milestone.name }}</span>
        <span class="sr-only">milestone</span>
      </span>
      <span v-if="issueCycle" class="flex shrink-0">
        <CyclePicker
          compact
          :cycles="cycleOptions"
          :selected="issueCycle"
          :model-value="issue.cycleId"
          @update:model-value="setCycle"
        />
      </span>
      <span
        v-if="shows('pullRequests') && issue.pullRequests[0]"
        :title="`Pull requests: ${pullRequestSummary}`"
        class="relative z-10 flex h-6 shrink-0 cursor-default items-center gap-1.5 rounded-full border border-hairline px-2 text-xs text-ink-muted tabular-nums"
        @click="onChipClick"
      >
        <PullRequestIcon :state="issue.pullRequests[0].state" />
        #{{ issue.pullRequests[0].number }}
        <span v-if="issue.pullRequests.length > 1" class="text-ink-subtle">
          +{{ issue.pullRequests.length - 1 }}
        </span>
        <span class="sr-only">Pull requests: {{ pullRequestSummary }}</span>
      </span>
      <span
        v-if="shows('links') && issue.linkCount"
        :title="`${issue.linkCount} ${issue.linkCount === 1 ? 'link' : 'links'}`"
        class="relative z-10 flex h-6 shrink-0 cursor-default items-center gap-1 rounded-full border border-hairline px-2 text-xs text-ink-muted tabular-nums"
        @click="onChipClick"
      >
        <Link2 class="size-3.5 text-ink-subtle" aria-hidden="true" />
        {{ issue.linkCount }}
        <span class="sr-only">{{ issue.linkCount === 1 ? 'link' : 'links' }}</span>
      </span>
      <DueDatePicker
        v-if="shows('dueDate')"
        row
        :category="issue.status.category"
        :model-value="issue.dueDate"
        @update:model-value="setDueDate"
      />
      <EstimatePicker
        v-if="shows('estimate') && estimates && estimates.scale !== 'off'"
        compact
        :scale="estimates.scale"
        :allow-zero="estimates.allowZero"
        :model-value="issue.estimate"
        @update:model-value="setEstimate"
      />
    </div>
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
      :title="`Updated ${fullDateFormat.format(issue.updatedAt)}`"
      class="relative z-10 ml-1 hidden w-12 shrink-0 cursor-default text-right text-xs text-ink-subtle tabular-nums sm:block"
      @click="onChipClick"
    >
      {{ dateFormat.format(issue.updatedAt) }}
    </time>
    <time
      v-if="shows('createdAt')"
      :datetime="issue.createdAt.toISOString()"
      :title="`Created ${fullDateFormat.format(issue.createdAt)}`"
      class="relative z-10 ml-1 hidden w-12 shrink-0 cursor-default text-right text-xs text-ink-subtle tabular-nums sm:block"
      @click="onChipClick"
    >
      {{ dateFormat.format(issue.createdAt) }}
    </time>
  </div>
</template>
