<script setup lang="ts">
import {
  nameSchema,
  projectSummarySchema,
  type Member,
  type Project,
  type ProjectLabel,
  type Team,
} from '@linear/contract'
import { ChevronDown, Ellipsis } from '@lucide/vue'
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import ImageUploadButton from '@/components/common/ImageUploadButton.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import { toPriority, type Priority } from '@/lib/priorities'
import type { ProjectChanges } from '../queries'
import ProjectDatePicker from './ProjectDatePicker.vue'
import ProjectLabelsPicker from './ProjectLabelsPicker.vue'
import ProjectLeadPicker from './ProjectLeadPicker.vue'
import ProjectMembersPicker from './ProjectMembersPicker.vue'
import ProjectMilestones from './ProjectMilestones.vue'
import ProjectResources from './ProjectResources.vue'
import ProjectStatusPicker from './ProjectStatusPicker.vue'
import ProjectTeamsPicker from './ProjectTeamsPicker.vue'
import ProjectUpdateCard from './ProjectUpdateCard.vue'

// Lazy: the chart (M9-05) isn't needed to read or edit the overview.
const ProjectProgressCard = defineAsyncComponent(() => import('./ProjectProgressCard.vue'))

const props = defineProps<{
  workspaceSlug: string
  project: Project
  members: Member[]
  teams: Team[]
  labels: ProjectLabel[]
}>()
const emit = defineEmits<{ save: [changes: ProjectChanges] }>()
const save = (changes: ProjectChanges) => emit('save', changes)

// Name and summary are drafts while focused, saved on blur (Enter); Esc reverts.
const nameDraft = ref('')
const summaryDraft = ref('')
const descriptionDraft = ref('')
const nameError = ref<string | null>(null)
const summaryError = ref<string | null>(null)
watch(
  () => props.project.id,
  () => {
    nameDraft.value = props.project.name
    summaryDraft.value = props.project.summary ?? ''
    descriptionDraft.value = props.project.description ?? ''
  },
  { immediate: true },
)
// A teammate's edit (realtime refetch) shows up unless this field is being edited.
watch(
  () => [props.project.name, props.project.summary] as const,
  ([name, summary]) => {
    const active = document.activeElement?.id
    if (active !== 'project-name') nameDraft.value = name
    if (active !== 'project-summary') summaryDraft.value = summary ?? ''
  },
)

function commitName() {
  const parsed = nameSchema.safeParse(nameDraft.value)
  if (!parsed.success) {
    nameError.value = parsed.error.issues[0]?.message ?? 'Invalid name'
    return
  }
  nameError.value = null
  if (parsed.data !== props.project.name) save({ name: parsed.data })
  nameDraft.value = parsed.data
}
function commitSummary() {
  const parsed = projectSummarySchema.safeParse(summaryDraft.value)
  if (!parsed.success) {
    summaryError.value = parsed.error.issues[0]?.message ?? 'Invalid summary'
    return
  }
  summaryError.value = null
  const next = parsed.data || null
  if (next !== props.project.summary) save({ summary: next })
  summaryDraft.value = parsed.data
}
function revert(event: KeyboardEvent, field: 'name' | 'summary') {
  if (field === 'name') {
    nameDraft.value = props.project.name
    nameError.value = null
  } else {
    summaryDraft.value = props.project.summary ?? ''
    summaryError.value = null
  }
  ;(event.target as HTMLInputElement).blur()
}

// The description saves when focus leaves the editor, or when leaving the page.
function commitDescription() {
  const next = descriptionDraft.value.trim() ? descriptionDraft.value : null
  if (next !== props.project.description) save({ description: next })
}
function onDescriptionFocusOut(event: FocusEvent) {
  const to = event.relatedTarget
  if (to instanceof Node && (event.currentTarget as HTMLElement).contains(to)) return
  commitDescription()
}
onBeforeUnmount(commitDescription)
const descriptionOpen = ref(true)
const moreProperties = ref(false)

/** A two-way binding for one project property, saved through the optimistic update. */
function bind<K extends keyof ProjectChanges & keyof Project>(key: K) {
  return computed({
    get: () => props.project[key],
    set: (value) => save({ [key]: value }),
  })
}
const status = bind('status')
const leadId = bind('leadId')
const memberIds = bind('memberIds')
const startDate = bind('startDate')
const targetDate = bind('targetDate')
const teamIds = bind('teamIds')
const labelIds = bind('labelIds')
const priority = computed({
  get: () => toPriority(props.project.priority),
  set: (value: Priority) => save({ priority: value }),
})

// The outline rail jumps to a section; ids are scoped to this page.
const sections = [
  { id: 'project-section-properties', label: 'Properties' },
  { id: 'project-section-progress', label: 'Progress' },
  { id: 'project-section-resources', label: 'Resources' },
  { id: 'project-section-update', label: 'Update' },
  { id: 'project-section-description', label: 'Description' },
  { id: 'project-section-milestones', label: 'Milestones' },
]
function jump(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el?.focus({ preventScroll: true })
}

const sectionClass = 'scroll-mt-6 outline-hidden'
const pickerRowClass =
  'flex flex-wrap items-center gap-1.5 [&_button]:border [&_button]:border-hairline'
</script>

<template>
  <div class="flex min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto grid w-full max-w-3xl content-start gap-8 px-8 pt-10 pb-16">
      <header class="grid gap-3">
        <div class="flex items-center gap-3">
          <span
            class="flex size-12 items-center justify-center rounded-lg border border-hairline bg-surface-2"
          >
            <ProjectIcon :src="project.iconUrl" size="lg" />
          </span>
          <ImageUploadButton
            kind="project_icon"
            :workspace-slug="workspaceSlug"
            :label="project.iconUploadId ? 'Change icon' : 'Upload icon'"
            :has-image="Boolean(project.iconUploadId)"
            @uploaded="(id) => save({ iconUploadId: id })"
            @remove="save({ iconUploadId: null })"
          />
        </div>
        <div class="grid gap-1">
          <label for="project-name" class="sr-only">Project name</label>
          <input
            id="project-name"
            v-model="nameDraft"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="Boolean(nameError)"
            :aria-describedby="nameError ? 'project-name-error' : undefined"
            class="-mx-1 rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight text-ink caret-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            @blur="commitName"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @keydown.esc.prevent="revert($event, 'name')"
          />
          <p v-if="nameError" id="project-name-error" class="text-xs text-danger" role="alert">
            {{ nameError }}
          </p>
          <label for="project-summary" class="sr-only">Summary</label>
          <input
            id="project-summary"
            v-model="summaryDraft"
            autocomplete="off"
            placeholder="Add a short summary…"
            :aria-invalid="Boolean(summaryError)"
            :aria-describedby="summaryError ? 'project-summary-error' : undefined"
            class="-mx-1 rounded-md bg-transparent px-1 text-[15px] text-ink-muted caret-primary outline-hidden placeholder:text-ink-tertiary focus-visible:ring-2 focus-visible:ring-ring"
            @blur="commitSummary"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            @keydown.esc.prevent="revert($event, 'summary')"
          />
          <p
            v-if="summaryError"
            id="project-summary-error"
            class="text-xs text-danger"
            role="alert"
          >
            {{ summaryError }}
          </p>
        </div>
      </header>

      <section
        id="project-section-properties"
        tabindex="-1"
        aria-labelledby="project-properties-heading"
        :class="sectionClass"
        class="grid gap-2"
      >
        <h2 id="project-properties-heading" class="text-xs font-medium text-ink-subtle">
          Properties
        </h2>
        <div :class="pickerRowClass">
          <ProjectStatusPicker v-model="status" />
          <PriorityPicker v-model="priority" no-hotkey />
          <ProjectLeadPicker v-model="leadId" :members="members" />
          <span class="flex items-center gap-1">
            <ProjectDatePicker v-model="startDate" label="Start date" />
            <span class="text-ink-tertiary" aria-hidden="true">→</span>
            <ProjectDatePicker v-model="targetDate" label="Target date" />
          </span>
          <ProjectTeamsPicker v-model="teamIds" :teams="teams" />
          <template v-if="moreProperties">
            <ProjectMembersPicker v-model="memberIds" :members="members" />
            <ProjectLabelsPicker
              v-model="labelIds"
              :labels="labels"
              :workspace-slug="workspaceSlug"
            />
          </template>
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-full text-ink-subtle outline-hidden hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            :aria-label="moreProperties ? 'Fewer properties' : 'More properties'"
            :aria-expanded="moreProperties"
            @click="moreProperties = !moreProperties"
          >
            <Ellipsis class="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div id="project-section-progress" tabindex="-1" :class="sectionClass">
        <ProjectProgressCard :workspace-slug="workspaceSlug" :project-id="project.id" />
      </div>

      <div id="project-section-resources" tabindex="-1" :class="sectionClass">
        <ProjectResources :workspace-slug="workspaceSlug" :project-id="project.id" />
      </div>

      <div id="project-section-update" tabindex="-1" :class="sectionClass">
        <ProjectUpdateCard :workspace-slug="workspaceSlug" :project-id="project.id" />
      </div>

      <section
        id="project-section-description"
        tabindex="-1"
        aria-label="Description"
        :class="sectionClass"
        class="grid gap-2"
      >
        <button
          type="button"
          class="-mx-1 flex w-fit items-center gap-1.5 rounded-md px-1 text-xs font-medium text-ink-subtle outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          :aria-expanded="descriptionOpen"
          aria-controls="project-description-body"
          @click="descriptionOpen = !descriptionOpen"
        >
          Description
          <ChevronDown
            class="size-3.5 transition-transform"
            :class="{ '-rotate-90': !descriptionOpen }"
            aria-hidden="true"
          />
        </button>
        <div
          v-show="descriptionOpen"
          id="project-description-body"
          class="-mx-1 rounded-md px-1"
          @focusout="onDescriptionFocusOut"
        >
          <MarkdownEditor
            v-model="descriptionDraft"
            label="Project description"
            placeholder="Add description…"
            class="min-h-16 py-1"
          />
        </div>
      </section>

      <div id="project-section-milestones" tabindex="-1" :class="sectionClass">
        <ProjectMilestones :workspace-slug="workspaceSlug" :project-id="project.id" />
      </div>
    </div>

    <nav
      aria-label="Outline"
      class="sticky top-0 hidden w-36 shrink-0 self-start pt-12 pr-4 xl:block"
    >
      <ul class="grid gap-0.5 border-l border-hairline">
        <li v-for="section in sections" :key="section.id">
          <button
            type="button"
            class="-ml-px w-full rounded-r-md border-l border-transparent py-1 pl-3 text-left text-xs text-ink-subtle outline-hidden hover:border-hairline-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            @click="jump(section.id)"
          >
            {{ section.label }}
          </button>
        </li>
      </ul>
    </nav>
  </div>
</template>
