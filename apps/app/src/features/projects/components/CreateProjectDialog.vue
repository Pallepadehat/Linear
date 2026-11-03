<script setup lang="ts">
import { createProjectInputSchema, type ProjectStatus } from '@linear/contract'
import { X } from '@lucide/vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ImageUploadButton from '@/components/common/ImageUploadButton.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { orpc } from '@/lib/orpc'
import { projectListOptions, storeProject } from '../queries'
import ProjectStatusPicker from './ProjectStatusPicker.vue'
import ProjectTeamsPicker from './ProjectTeamsPicker.vue'

const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const formError = ref<string | null>(null)
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')
// Shown before the project exists; the upload id goes into the create call.
const iconPreview = ref<string | null>(null)

const {
  handleSubmit,
  isSubmitting,
  values,
  errors,
  setFieldValue,
  setFieldError,
  resetForm,
  defineField,
} = useForm({
  validationSchema: toTypedSchema(createProjectInputSchema.omit({ workspaceSlug: true })),
  initialValues: {
    name: '',
    description: '',
    status: 'planned',
    iconUploadId: null,
    teamIds: [],
  },
})
// Like the issue dialog, errors appear only after submitting, then clear once fixed.
const [name, nameAttrs] = defineField('name', {
  validateOnBlur: false,
  validateOnModelUpdate: false,
})
watch(name, (value) => {
  if (errors.value.name && value?.trim()) setFieldError('name', undefined)
})
const [description, descriptionAttrs] = defineField('description')

const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

const status = computed({
  get: () => values.status ?? 'planned',
  set: (value: ProjectStatus) => setFieldValue('status', value, false),
})
const teamIds = computed({
  get: () => values.teamIds ?? [],
  set: (ids: string[]) => setFieldValue('teamIds', ids, false),
})

function revokePreview() {
  if (iconPreview.value) URL.revokeObjectURL(iconPreview.value)
  iconPreview.value = null
}

watch(open, (isOpen) => {
  if (!isOpen) return
  formError.value = null
  revokePreview()
  resetForm()
})

function onIconUploaded(uploadId: string, file: File) {
  setFieldValue('iconUploadId', uploadId, false)
  revokePreview()
  iconPreview.value = URL.createObjectURL(file)
}
function removeIcon() {
  setFieldValue('iconUploadId', null, false)
  revokePreview()
}

const create = useMutation(orpc.projects.create.mutationOptions())

const onSubmit = handleSubmit(async (form) => {
  formError.value = null
  try {
    const project = await create.mutateAsync({
      ...form,
      workspaceSlug: slug.value,
      description: form.description?.trim() ? form.description.trim() : null,
    })
    storeProject(queryClient, slug.value, project)
    await queryClient.invalidateQueries({ queryKey: projectListOptions(slug.value).queryKey })
    toast.success('Project created', { description: project.name })
    open.value = false
    await router.push({
      name: 'project',
      params: { workspaceSlug: slug.value, projectId: project.id },
    })
  } catch (error) {
    formError.value = errorMessage(error)
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    void onSubmit()
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :show-close-button="false"
      class="top-[12%] translate-y-0 gap-0 rounded-xl border-hairline bg-floating p-0 shadow-floating sm:max-w-2xl"
      @keydown="onKeydown"
      @open-auto-focus.prevent="nameInput?.focus()"
    >
      <form novalidate class="flex flex-col" @submit="onSubmit">
        <div class="flex items-center gap-1.5 px-4 pt-3.5">
          <DialogTitle class="text-[13px] font-normal text-ink">New project</DialogTitle>
          <DialogClose as-child>
            <Button type="button" variant="ghost" size="icon-sm" class="ml-auto" aria-label="Close">
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription class="sr-only">
          Create a project. Press Cmd+Enter to submit.
        </DialogDescription>
        <div class="grid gap-3 px-5 pt-3">
          <div class="flex items-center gap-3">
            <ProjectIcon :src="iconPreview" size="lg" />
            <ImageUploadButton
              kind="project_icon"
              :workspace-slug="slug"
              label="Upload icon"
              :has-image="Boolean(values.iconUploadId)"
              @uploaded="onIconUploaded"
              @remove="removeIcon"
            />
          </div>
          <div class="grid gap-1">
            <label for="new-project-name" class="sr-only">Project name</label>
            <input
              id="new-project-name"
              ref="nameInput"
              v-model="name"
              v-bind="nameAttrs"
              autocomplete="off"
              placeholder="Project name"
              :aria-invalid="Boolean(errors.name)"
              :aria-describedby="errors.name ? 'new-project-name-error' : undefined"
              class="w-full bg-transparent text-lg font-semibold tracking-tight text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
            />
            <p
              v-if="errors.name"
              id="new-project-name-error"
              class="text-xs text-danger"
              role="alert"
            >
              {{ errors.name }}
            </p>
          </div>
          <label for="new-project-description" class="sr-only">Description</label>
          <textarea
            id="new-project-description"
            v-model="description"
            v-bind="descriptionAttrs"
            rows="3"
            placeholder="Add a short summary..."
            class="w-full resize-none bg-transparent text-sm text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
          />
        </div>
        <div
          class="flex flex-wrap items-center gap-1.5 px-4 pt-2 pb-3 [&_button]:border [&_button]:border-hairline"
        >
          <ProjectStatusPicker v-model="status" />
          <ProjectTeamsPicker v-model="teamIds" :teams="teams ?? []" />
        </div>
        <DialogFooter class="flex-row items-center gap-3 px-4 pt-1 pb-3.5">
          <p v-if="formError" class="text-[13px] text-danger" role="alert">{{ formError }}</p>
          <Button type="submit" size="sm" class="ml-auto" :disabled="isSubmitting">
            Create project
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
