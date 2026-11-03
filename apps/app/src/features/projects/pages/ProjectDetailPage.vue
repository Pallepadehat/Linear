<script setup lang="ts">
import { nameSchema, type Project, type UpdateProjectInput } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import EmptyState from '@/components/common/EmptyState.vue'
import ImageUploadButton from '@/components/common/ImageUploadButton.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import IssueList from '@/features/issues/components/IssueList.vue'
import { errorCode, errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import ProjectProgress from '../components/ProjectProgress.vue'
import ProjectStatusPicker from '../components/ProjectStatusPicker.vue'
import ProjectTeamsPicker from '../components/ProjectTeamsPicker.vue'
import { projectListOptions, projectOptions, storeProject } from '../queries'

type Changes = Omit<UpdateProjectInput, 'workspaceSlug' | 'id'>

const route = useRoute()
const ui = useUiStore()
const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const projectId = computed(() => String(route.params.projectId))

const { data: project, error } = useQuery(
  computed(() => projectOptions(slug.value, projectId.value)),
)
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

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
const update = useMutation({
  mutationFn: (changes: Changes) =>
    client.projects.update({ workspaceSlug: slug.value, id: projectId.value, ...changes }),
  onMutate: async (changes) => {
    const key = projectOptions(slug.value, projectId.value).queryKey
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData(key)
    if (previous) {
      const { iconUploadId, ...rest } = changes
      const next: Project = { ...previous, ...rest }
      // The new icon's URL only comes back from the server.
      if (iconUploadId !== undefined) next.iconUploadId = iconUploadId
      if (iconUploadId === null) next.iconUrl = null
      storeProject(queryClient, slug.value, next)
    }
    return { previous }
  },
  onError: (err, _changes, context) => {
    if (context?.previous) storeProject(queryClient, slug.value, context.previous)
    toast.error(errorMessage(err))
  },
  onSuccess: (saved) => storeProject(queryClient, slug.value, saved),
  onSettled: () =>
    queryClient.invalidateQueries({ queryKey: projectListOptions(slug.value).queryKey }),
})

function save(changes: Changes) {
  update.mutate(changes)
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
        <ProjectTeamsPicker v-model="teamIds" :teams="teams ?? []" />
        <ProjectProgress class="ml-2" :progress="project.progress" />
      </div>
    </section>
    <h2 class="sr-only">Issues</h2>
    <IssueList :key="project.id" :workspace-slug="slug" :project-id="project.id" />
  </div>
</template>
