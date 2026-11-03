<script setup lang="ts">
import { nameSchema } from '@linear/contract'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch, watchEffect } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import ImageUploadButton from '@/components/common/ImageUploadButton.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import IssueList from '@/features/issues/components/IssueList.vue'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { toPriority, type Priority } from '@/lib/priorities'
import { useUiStore } from '@/stores/ui'
import ProjectActivityCard from '../components/ProjectActivityCard.vue'
import ProjectActivityFeed from '../components/ProjectActivityFeed.vue'
import ProjectDatePicker from '../components/ProjectDatePicker.vue'
import ProjectLabelsPicker from '../components/ProjectLabelsPicker.vue'
import ProjectLeadPicker from '../components/ProjectLeadPicker.vue'
import ProjectMembersPicker from '../components/ProjectMembersPicker.vue'
import ProjectMilestones from '../components/ProjectMilestones.vue'
import ProjectProgress from '../components/ProjectProgress.vue'
import ProjectStatusPicker from '../components/ProjectStatusPicker.vue'
import ProjectTeamsPicker from '../components/ProjectTeamsPicker.vue'
import {
  projectLabelListOptions,
  projectOptions,
  useUpdateProject,
  type ProjectChanges,
} from '../queries'

const route = useRoute()
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const projectId = computed(() => String(route.params.projectId))
// Interim until the Overview / Activity / Issues tabs (M9-03): `?tab=activity` swaps the
// issue list for the full feed.
const showActivity = computed(() => route.query.tab === 'activity')
const issuesQuery = computed(() => {
  const { tab: _, ...rest } = route.query
  return rest
})

const { data: project, error } = useQuery(
  computed(() => projectOptions(slug.value, projectId.value)),
)
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const { data: labels } = useQuery(computed(() => projectLabelListOptions(slug.value)))

watchEffect(() => {
  if (!project.value) return
  ui.breadcrumb = ['Projects', project.value.name]
  ui.favoriteTarget = {
    entityType: 'project',
    entityId: project.value.id,
    name: project.value.name,
    iconUrl: project.value.iconUrl,
  }
})

// Edits apply to the cache immediately and roll back if the save fails.
const update = useUpdateProject(slug)
function save(changes: ProjectChanges) {
  if (project.value) update.mutate({ project: project.value, changes })
}

// Name and description are drafts while focused, saved on blur (Enter for the name).
const nameDraft = ref('')
const descriptionDraft = ref('')
const nameError = ref<string | null>(null)
watch(
  project,
  (value) => {
    if (!value) return
    nameDraft.value = value.name
    descriptionDraft.value = value.description ?? ''
  },
  { immediate: true },
)

function commitName() {
  if (!project.value) return
  const parsed = nameSchema.safeParse(nameDraft.value)
  if (!parsed.success) {
    nameError.value = parsed.error.issues[0]?.message ?? 'Invalid name'
    return
  }
  nameError.value = null
  if (parsed.data !== project.value.name) save({ name: parsed.data })
  nameDraft.value = parsed.data
}
function revertName(event: KeyboardEvent) {
  nameDraft.value = project.value?.name ?? ''
  nameError.value = null
  ;(event.target as HTMLInputElement).blur()
}
function commitDescription() {
  if (!project.value) return
  const next = descriptionDraft.value.trim() || null
  if (next !== project.value.description) save({ description: next })
}

const status = computed({
  get: () => project.value?.status ?? 'planned',
  set: (value) => save({ status: value }),
})
const teamIds = computed({
  get: () => project.value?.teamIds ?? [],
  set: (ids: string[]) => save({ teamIds: ids }),
})
const priority = computed({
  get: () => toPriority(project.value?.priority),
  set: (value: Priority) => save({ priority: value }),
})
const leadId = computed({
  get: () => project.value?.leadId ?? null,
  set: (id: string | null) => save({ leadId: id }),
})
const memberIds = computed({
  get: () => project.value?.memberIds ?? [],
  set: (ids: string[]) => save({ memberIds: ids }),
})
const startDate = computed({
  get: () => project.value?.startDate ?? null,
  set: (day: string | null) => save({ startDate: day }),
})
const targetDate = computed({
  get: () => project.value?.targetDate ?? null,
  set: (day: string | null) => save({ targetDate: day }),
})
const labelIds = computed({
  get: () => project.value?.labelIds ?? [],
  set: (ids: string[]) => save({ labelIds: ids }),
})
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="Project not found" />
  <EmptyState
    v-else-if="error"
    title="Couldn't load project"
    description="Check your connection and try again."
  />
  <div v-else-if="project" class="flex min-h-0 flex-1 flex-col">
    <section
      aria-label="Project details"
      class="grid shrink-0 gap-3 border-b border-hairline px-8 pt-8 pb-5"
    >
      <div class="flex items-center gap-3">
        <ProjectIcon :src="project.iconUrl" size="lg" />
        <ImageUploadButton
          kind="project_icon"
          :workspace-slug="slug"
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
          :aria-invalid="Boolean(nameError)"
          :aria-describedby="nameError ? 'project-name-error' : undefined"
          class="-mx-1 rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight text-ink caret-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          @blur="commitName"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          @keydown.esc.prevent="revertName"
        />
        <p v-if="nameError" id="project-name-error" class="text-xs text-danger" role="alert">
          {{ nameError }}
        </p>
      </div>
      <label for="project-description" class="sr-only">Description</label>
      <textarea
        id="project-description"
        v-model="descriptionDraft"
        rows="2"
        placeholder="Add a short summary..."
        class="-mx-1 field-sizing-content min-h-12 resize-none rounded-md bg-transparent px-1 text-sm text-ink-muted caret-primary outline-hidden placeholder:text-ink-tertiary focus-visible:ring-2 focus-visible:ring-ring"
        @blur="commitDescription"
      />
      <div class="flex flex-wrap items-center gap-1.5 [&_button]:border [&_button]:border-hairline">
        <ProjectStatusPicker v-model="status" />
        <PriorityPicker v-model="priority" no-hotkey />
        <ProjectLeadPicker v-model="leadId" :members="members ?? []" />
        <ProjectMembersPicker v-model="memberIds" :members="members ?? []" />
        <ProjectDatePicker v-model="startDate" label="Start date" />
        <ProjectDatePicker v-model="targetDate" label="Target date" />
        <ProjectTeamsPicker v-model="teamIds" :teams="teams ?? []" />
        <ProjectLabelsPicker v-model="labelIds" :labels="labels ?? []" :workspace-slug="slug" />
        <ProjectProgress class="ml-2" :progress="project.progress" />
      </div>
      <ProjectMilestones :workspace-slug="slug" :project-id="project.id" />
    </section>
    <div class="flex min-h-0 flex-1">
      <div v-if="showActivity" class="min-w-0 flex-1 overflow-y-auto px-8 py-5">
        <RouterLink
          :to="{ query: issuesQuery }"
          class="mb-4 inline-block rounded-xs text-xs text-ink-subtle outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Issues
        </RouterLink>
        <ProjectActivityFeed :key="project.id" :workspace-slug="slug" :project-id="project.id" />
      </div>
      <div v-else class="flex min-h-0 min-w-0 flex-1 flex-col">
        <h2 class="sr-only">Issues</h2>
        <IssueList :key="project.id" :workspace-slug="slug" :project-id="project.id" />
      </div>
      <aside
        aria-label="Project panel"
        class="hidden w-80 shrink-0 overflow-y-auto border-l border-hairline p-4 lg:block"
      >
        <ProjectActivityCard :workspace-slug="slug" :project-id="project.id" />
      </aside>
    </div>
  </div>
</template>
