<script setup lang="ts">
import type { Issue, Label, WorkflowStatus } from '@linear/contract'
import { Trash2, X } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import AssigneePicker, { type AssigneeOption } from '@/components/common/AssigneePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import ProjectPicker from '@/components/common/ProjectPicker.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { projectListOptions } from '@/features/projects/queries'
import { toPriority } from '@/lib/priorities'
import { useIssueSelectionStore } from '@/stores/issue-selection'
import type { BulkIssueChange } from '../issue-cache'
import { useBulkDeleteIssues, useBulkUpdateIssues } from '../queries'

// The floating bar for the selected issues (docs/domain.md → Bulk actions). Each
// picker shows the value the selection shares, or its name when they differ.
const props = defineProps<{
  workspaceSlug: string
  /** The issues on screen; the selected ones are picked from these. */
  issues: Issue[]
  statusesByTeam: ReadonlyMap<string, WorkflowStatus[]>
  users: AssigneeOption[]
  labels: Label[]
}>()

const selection = useIssueSelectionStore()
const selected = computed(() => props.issues.filter((i) => selection.selectedIds.has(i.id)))
const count = computed(() => selected.value.length)

/** The value every selected issue shares; `undefined` when they differ. */
function shared<T>(pick: (issue: Issue) => T): T | undefined {
  const [first, ...rest] = selected.value
  if (!first) return undefined
  const value = pick(first)
  return rest.every((issue) => pick(issue) === value) ? value : undefined
}

// Statuses and team labels belong to a team, so they're offered for one team at a time.
const teamId = computed(() => shared((issue) => issue.teamId) ?? null)
const statuses = computed(() =>
  teamId.value ? (props.statusesByTeam.get(teamId.value) ?? []) : [],
)
const statusId = computed(() => shared((issue) => issue.status.id) ?? '')
const priority = computed(() => shared((issue) => issue.priority))
const assigneeId = computed(() => shared((issue) => issue.assigneeId))
const projectId = computed(() => shared((issue) => issue.projectId))
// Checked in the label picker: the labels every selected issue has.
const sharedLabelIds = computed(() => {
  const [first, ...rest] = selected.value
  return (first?.labels ?? [])
    .map((label) => label.id)
    .filter((id) => rest.every((issue) => issue.labels.some((label) => label.id === id)))
})

// Matches no option, so picking "No assignee" / "No project" for a mixed selection is a
// change the picker reports (a model only emits values that differ from the current one).
const MIXED = ''

const { data: projects } = useQuery(computed(() => projectListOptions(props.workspaceSlug)))
const bulkUpdate = useBulkUpdateIssues(() => props.workspaceSlug)
const bulkDelete = useBulkDeleteIssues(() => props.workspaceSlug)

/** Labels keep the selection so several can be toggled in a row; the rest clear it. */
function apply(change: BulkIssueChange, keepSelection = false) {
  const issues = selected.value
  if (!issues.length) return
  bulkUpdate.mutate(
    { issues, change },
    { onSuccess: () => (keepSelection ? undefined : selection.clear()) },
  )
}

function setStatus(id: string) {
  const status = statuses.value.find((s) => s.id === id)
  if (status) apply({ status })
}
function setLabels(next: Label[]) {
  const before = new Set(sharedLabelIds.value)
  const after = new Set(next.map((label) => label.id))
  apply(
    {
      addLabels: next.filter((label) => !before.has(label.id)),
      removeLabelIds: [...before].filter((id) => !after.has(id)),
    },
    true,
  )
}

const confirmingDelete = ref(false)
// Fixed when the dialog opens, so the title doesn't change while it animates closed.
const deleteCount = ref(0)
function askDelete() {
  deleteCount.value = count.value
  confirmingDelete.value = true
}
function confirmDelete() {
  const ids = selected.value.map((issue) => issue.id)
  selection.clear()
  bulkDelete.mutate(ids)
}
</script>

<template>
  <Transition
    enter-from-class="translate-y-2 opacity-0"
    leave-to-class="translate-y-2 opacity-0"
    enter-active-class="transition duration-150"
    leave-active-class="transition duration-100"
  >
    <div
      v-if="count"
      class="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-2 md:px-4"
    >
      <!-- A hotkey scope, so the pickers' S/P/A/L only fire with focus in the bar. -->
      <div
        data-hotkey-scope
        role="toolbar"
        aria-label="Bulk actions"
        class="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-hairline-strong bg-floating p-1 shadow-floating"
      >
        <div
          class="flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-hairline pr-0.5 pl-2.5"
        >
          <span class="text-ink tabular-nums whitespace-nowrap" aria-live="polite">
            {{ count }} selected
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            class="rounded-full text-ink-subtle"
            aria-label="Clear selection"
            @click="selection.clear()"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <span class="mx-1 h-4 w-px shrink-0 bg-hairline" aria-hidden="true" />
        <StatusPicker
          v-if="statuses.length"
          no-hotkey
          :statuses="statuses"
          :model-value="statusId"
          @update:model-value="setStatus"
        />
        <PriorityPicker
          no-hotkey
          :model-value="toPriority(priority ?? 0)"
          :trigger-text="priority === undefined ? 'Priority' : undefined"
          @pick="(value) => apply({ priority: value })"
        />
        <AssigneePicker
          no-hotkey
          :users="users"
          :model-value="assigneeId === undefined ? MIXED : assigneeId"
          :trigger-text="assigneeId === undefined ? 'Assignee' : undefined"
          @update:model-value="(value) => apply({ assigneeId: value })"
        />
        <LabelPicker
          :labels="labels"
          :team-id="teamId"
          :model-value="sharedLabelIds"
          trigger-text="Labels"
          @update:labels="setLabels"
        />
        <ProjectPicker
          :projects="projects ?? []"
          :model-value="projectId === undefined ? MIXED : projectId"
          @update:model-value="(value) => apply({ projectId: value })"
        />
        <span class="mx-1 h-4 w-px shrink-0 bg-hairline" aria-hidden="true" />
        <Button
          variant="ghost"
          size="sm"
          class="shrink-0 rounded-full text-ink max-md:size-7 max-md:px-0"
          :aria-label="`Delete ${count} ${count === 1 ? 'issue' : 'issues'}`"
          @click="askDelete"
        >
          <Trash2 class="text-ink-subtle" aria-hidden="true" />
          <span class="max-md:hidden">Delete</span>
        </Button>
      </div>
    </div>
  </Transition>

  <AlertDialog v-model:open="confirmingDelete">
    <AlertDialogContent
      class="gap-4 rounded-xl border-hairline bg-floating p-5 shadow-floating sm:max-w-md"
    >
      <AlertDialogHeader class="gap-1.5 text-left">
        <AlertDialogTitle class="text-[15px] font-semibold text-ink">
          Delete {{ deleteCount }} {{ deleteCount === 1 ? 'issue' : 'issues' }}?
        </AlertDialogTitle>
        <AlertDialogDescription class="text-[13px] text-ink-muted">
          The issues, their comments and attachments are deleted for everyone. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :class="buttonVariants({ variant: 'secondary', size: 'sm' })">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          :class="buttonVariants({ variant: 'destructive', size: 'sm' })"
          @click="confirmDelete"
        >
          Delete issues
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
