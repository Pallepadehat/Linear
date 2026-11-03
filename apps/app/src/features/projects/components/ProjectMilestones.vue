<script setup lang="ts">
import { nameSchema, type Milestone } from '@linear/contract'
import { ArrowDown, ArrowUp, CalendarDays, Ellipsis, Pencil, Plus, Trash2 } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, ref } from 'vue'
import MilestoneIcon from '@/components/common/MilestoneIcon.vue'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  milestoneListOptions,
  milestonePercent,
  moveMilestone,
  useMilestoneMutations,
} from '../milestones'
import ProjectDatePicker from './ProjectDatePicker.vue'

// The project page's milestone section (docs/domain.md → Project milestones).
const props = defineProps<{ workspaceSlug: string; projectId: string }>()

const { data: milestones } = useQuery(
  computed(() => milestoneListOptions(props.workspaceSlug, props.projectId)),
)
const { create, update, reorder, remove } = useMilestoneMutations(
  () => props.workspaceSlug,
  () => props.projectId,
)

// Inline add and rename share one draft input: ↵ saves, Esc cancels.
const adding = ref(false)
const renamingId = ref<string | null>(null)
const draft = ref('')
const draftError = ref<string | null>(null)
const draftInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

async function focusDraft() {
  await nextTick()
  const el = Array.isArray(draftInput.value) ? draftInput.value[0] : draftInput.value
  el?.focus()
  el?.select()
}
function startAdd() {
  renamingId.value = null
  adding.value = true
  draft.value = ''
  draftError.value = null
  void focusDraft()
}
function startRename(milestone: Milestone) {
  adding.value = false
  renamingId.value = milestone.id
  draft.value = milestone.name
  draftError.value = null
  menuHandsOffFocus = true
}
// Rename and "Set target date" move focus elsewhere; the closing menu would otherwise
// return it to its trigger (and blur the rename input at once).
let menuHandsOffFocus = false
function onMenuCloseAutoFocus(event: Event) {
  if (!menuHandsOffFocus) return
  menuHandsOffFocus = false
  event.preventDefault()
  if (renamingId.value) void focusDraft()
}
function cancelDraft() {
  adding.value = false
  renamingId.value = null
  draftError.value = null
}
function saveDraft() {
  const parsed = nameSchema.safeParse(draft.value)
  if (!parsed.success) {
    draftError.value = parsed.error.issues[0]?.message ?? 'Invalid name'
    return
  }
  const renaming = milestones.value?.find((m) => m.id === renamingId.value)
  if (renaming) {
    if (parsed.data !== renaming.name)
      update.mutate({ milestone: renaming, changes: { name: parsed.data } })
    cancelDraft()
    return
  }
  // Keep the add row open (and focused) for the next milestone, like Linear.
  if (create.isPending.value) return
  create.mutate(parsed.data, { onSuccess: () => (draft.value = '') })
}

function setTargetDate(milestone: Milestone, day: string | null) {
  if (day !== milestone.targetDate) update.mutate({ milestone, changes: { targetDate: day } })
}
// "Set target date" opens the row's date picker once the menu has closed.
const datePickerFor = ref<string | null>(null)
function openDatePicker(milestone: Milestone) {
  menuHandsOffFocus = true
  setTimeout(() => (datePickerFor.value = milestone.id), 0)
}

function move(id: string, toIndex: number) {
  const list = milestones.value ?? []
  const next = moveMilestone(list, id, toIndex)
  if (next !== list) reorder.mutate(next)
}

// Drag to reorder: the row being dragged and the gap it would drop into (before row `index`).
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)
function onDragStart(event: DragEvent, index: number) {
  dragIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(event: DragEvent, index: number) {
  if (dragIndex.value === null) return
  event.preventDefault()
  const { top, height } = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropIndex.value = event.clientY < top + height / 2 ? index : index + 1
}
function onDrop() {
  const from = dragIndex.value
  const gap = dropIndex.value
  endDrag()
  const dragged = from === null ? undefined : milestones.value?.[from]
  if (from === null || gap === null || !dragged) return
  move(dragged.id, gap > from ? gap - 1 : gap)
}
function endDrag() {
  dragIndex.value = null
  dropIndex.value = null
}

// The dialog closes (clearing `deleteOpen`) before its action's click runs, so the
// target is kept separately.
const deleteOpen = ref(false)
const toDelete = ref<Milestone | null>(null)
function askDelete(milestone: Milestone) {
  toDelete.value = milestone
  deleteOpen.value = true
}
function confirmDelete() {
  if (toDelete.value) remove.mutate(toDelete.value)
  deleteOpen.value = false
}
</script>

<template>
  <section aria-labelledby="milestones-heading" class="grid gap-1">
    <div class="flex h-7 items-center justify-between">
      <h2 id="milestones-heading" class="text-xs font-medium text-ink-subtle">Milestones</h2>
      <Button variant="ghost" size="sm" class="text-ink-muted" @click="startAdd">
        <Plus aria-hidden="true" />
        Milestone
      </Button>
    </div>
    <ul v-if="milestones?.length" class="grid">
      <li
        v-for="(milestone, index) in milestones"
        :key="milestone.id"
        class="group/milestone relative flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-surface-2"
        :class="dragIndex === index && 'opacity-40'"
        :draggable="renamingId !== milestone.id"
        @dragstart="onDragStart($event, index)"
        @dragover="onDragOver($event, index)"
        @drop.prevent="onDrop"
        @dragend="endDrag"
      >
        <span
          v-if="dropIndex === index || (dropIndex === index + 1 && index === milestones.length - 1)"
          class="pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-primary"
          :class="dropIndex === index ? '-top-px' : '-bottom-px'"
          aria-hidden="true"
        />
        <MilestoneIcon :progress="milestone.progress" />
        <template v-if="renamingId === milestone.id">
          <label :for="`milestone-name-${milestone.id}`" class="sr-only">Milestone name</label>
          <input
            :id="`milestone-name-${milestone.id}`"
            ref="draftInput"
            v-model="draft"
            autocomplete="off"
            class="h-7 min-w-0 flex-1 rounded-md border border-hairline-strong bg-surface-1 px-2 text-ink caret-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            :aria-invalid="Boolean(draftError)"
            @keydown.enter.prevent="saveDraft"
            @keydown.esc.prevent="cancelDraft"
            @blur="cancelDraft"
          />
        </template>
        <span v-else class="min-w-0 flex-1 truncate text-ink">{{ milestone.name }}</span>
        <span class="shrink-0 text-ink-subtle tabular-nums">
          {{ milestonePercent(milestone) }}%
          <span class="sr-only">complete,</span>
          <span class="ml-1.5 text-ink-tertiary">
            {{ milestone.doneCount }}/{{ milestone.issueCount }}
          </span>
          <span class="sr-only">issues done</span>
        </span>
        <ProjectDatePicker
          :open="datePickerFor === milestone.id"
          :model-value="milestone.targetDate"
          label="Target date"
          compact
          @update:open="(open) => (datePickerFor = open ? milestone.id : null)"
          @update:model-value="(day) => setTargetDate(milestone, day)"
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            class="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-subtle opacity-0 outline-hidden group-focus-within/milestone:opacity-100 group-hover/milestone:opacity-100 hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100"
            :aria-label="`${milestone.name} options`"
          >
            <Ellipsis class="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-52" @close-auto-focus="onMenuCloseAutoFocus">
            <DropdownMenuItem @select="startRename(milestone)">
              <Pencil class="size-4" aria-hidden="true" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem @select="openDatePicker(milestone)">
              <CalendarDays class="size-4" aria-hidden="true" />
              Set target date
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="index === 0" @select="move(milestone.id, index - 1)">
              <ArrowUp class="size-4" aria-hidden="true" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              :disabled="index === milestones.length - 1"
              @select="move(milestone.id, index + 1)"
            >
              <ArrowDown class="size-4" aria-hidden="true" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="askDelete(milestone)">
              <Trash2 class="size-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
    <div v-if="adding" class="flex h-9 items-center gap-2.5 px-2 text-[13px]">
      <MilestoneIcon />
      <label for="new-milestone" class="sr-only">New milestone name</label>
      <input
        id="new-milestone"
        ref="draftInput"
        v-model="draft"
        autocomplete="off"
        placeholder="Milestone name"
        class="h-7 min-w-0 flex-1 rounded-md border border-hairline-strong bg-surface-1 px-2 text-ink caret-primary outline-hidden placeholder:text-ink-tertiary focus-visible:ring-2 focus-visible:ring-ring"
        :aria-invalid="Boolean(draftError)"
        :aria-describedby="draftError ? 'milestone-draft-error' : undefined"
        @keydown.enter.prevent="saveDraft"
        @keydown.esc.prevent="cancelDraft"
      />
      <span class="shrink-0 text-xs text-ink-subtle">↵ to save · Esc to cancel</span>
    </div>
    <p v-if="draftError" id="milestone-draft-error" class="px-2 text-xs text-danger" role="alert">
      {{ draftError }}
    </p>
    <p v-if="!adding && milestones?.length === 0" class="px-2 text-[13px] text-ink-tertiary">
      Split the project into milestones to track each phase's progress.
    </p>

    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent
        class="gap-4 rounded-xl border-hairline bg-floating p-5 shadow-floating sm:max-w-md"
      >
        <AlertDialogHeader class="gap-1.5 text-left">
          <AlertDialogTitle class="text-[15px] font-semibold text-ink">
            Delete {{ toDelete?.name }}?
          </AlertDialogTitle>
          <AlertDialogDescription class="text-[13px] text-ink-muted">
            Its issues stay in the project without a milestone. This can't be undone.
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
            Delete milestone
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
