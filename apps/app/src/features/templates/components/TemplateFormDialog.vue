<script setup lang="ts">
import { templateFormSchema, type IssueTemplate } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'
import type { z } from 'zod'
import AssigneePicker from '@/components/common/AssigneePicker.vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import FormField from '@/components/common/FormField.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import ProjectPicker from '@/components/common/ProjectPicker.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { projectListOptions } from '@/features/projects/queries'
import { errorCode, errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { client, orpc } from '@/lib/orpc'
import { toPriority, type Priority } from '@/lib/priorities'
import { templatesKey } from '../queries'

// `template` edits it; otherwise creates one in `teamId`'s scope (null = workspace).
type TemplateFields = Omit<z.output<typeof templateFormSchema>, 'teamId'>

const props = defineProps<{ template: IssueTemplate | null; teamId: string | null }>()
const open = defineModel<boolean>('open', { required: true })

const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const formError = ref<string | null>(null)
const scopeTeamId = computed(() => (props.template ? props.template.teamId : props.teamId))

const { handleSubmit, isSubmitting, values, setFieldValue, setFieldError, resetForm } = useForm({
  validationSchema: toTypedSchema(templateFormSchema),
})

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    formError.value = null
    const t = props.template
    resetForm({
      values: {
        name: t?.name ?? '',
        title: t?.title ?? '',
        description: t?.description ?? '',
        statusId: t?.statusId ?? null,
        priority: t?.priority ?? null,
        assigneeId: t?.assigneeId ?? null,
        projectId: t?.projectId ?? null,
        labelIds: t?.labelIds ?? [],
      },
    })
  },
  { immediate: true },
)

const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
// A team template picks from its team's statuses. A workspace template picks from the
// first team's; other teams match it by category when it is used.
const statusTeam = computed(() =>
  scopeTeamId.value ? teams.value?.find((t) => t.id === scopeTeamId.value) : teams.value?.[0],
)
const { data: teamWithStatuses } = useQuery(
  computed(() => ({
    ...orpc.teams.get.queryOptions({
      input: { workspaceSlug: slug.value, key: statusTeam.value?.key ?? '' },
    }),
    enabled: open.value && Boolean(statusTeam.value),
  })),
)
const statuses = computed(() => teamWithStatuses.value?.statuses ?? [])
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const assignees = computed(
  () =>
    members.value?.map((m) => ({
      id: m.userId,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl,
    })) ?? [],
)
const { data: labels } = useQuery(
  computed(() => orpc.labels.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const { data: projects } = useQuery(computed(() => projectListOptions(slug.value)))

// The pickers want concrete values; the form keeps the contract's nullable shape.
const statusId = computed({
  get: () => values.statusId ?? '',
  set: (id: string) => setFieldValue('statusId', id || null, false),
})
// "No priority" leaves the team's default priority in place.
const priority = computed({
  get: () => toPriority(values.priority ?? 0),
  set: (value: Priority) => setFieldValue('priority', value === 0 ? null : value, false),
})
const assigneeId = computed({
  get: () => values.assigneeId ?? null,
  set: (id: string | null) => setFieldValue('assigneeId', id, false),
})
const projectId = computed({
  get: () => values.projectId ?? null,
  set: (id: string | null) => setFieldValue('projectId', id, false),
})
const labelIds = computed({
  get: () => values.labelIds ?? [],
  set: (ids: string[]) => setFieldValue('labelIds', ids, false),
})
const description = computed({
  get: () => values.description ?? '',
  set: (value: string) => setFieldValue('description', value, false),
})

const save = useMutation({
  mutationFn: (form: TemplateFields) => {
    const fields = {
      ...form,
      description: form.description?.trim() ? form.description : null,
    }
    return props.template
      ? client.templates.update({ workspaceSlug: slug.value, id: props.template.id, ...fields })
      : client.templates.create({ workspaceSlug: slug.value, teamId: props.teamId, ...fields })
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey() }),
})

const onSubmit = handleSubmit(async ({ teamId: _, ...form }) => {
  formError.value = null
  try {
    await save.mutateAsync(form)
    open.value = false
  } catch (error) {
    if (errorCode(error) === 'CONFLICT') setFieldError('name', errorMessage(error))
    else formError.value = errorMessage(error)
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-0 rounded-xl border-hairline bg-floating p-0 sm:max-w-2xl">
      <form novalidate class="flex flex-col" @submit="onSubmit">
        <div class="grid gap-1 px-5 pt-4">
          <DialogTitle class="text-[15px] font-semibold text-ink">
            {{ template ? 'Edit template' : 'New template' }}
          </DialogTitle>
          <DialogDescription class="text-ink-subtle">
            Prefills new issues. Fields left empty keep the team's defaults.
          </DialogDescription>
        </div>
        <div class="grid gap-3 px-5 pt-4">
          <FormField name="name" label="Template name" placeholder="Bug report" autofocus />
          <FormField name="title" label="Issue title" placeholder="Bug: " />
          <div class="grid gap-1.5">
            <span class="text-sm font-medium text-ink-muted" aria-hidden="true"> Description </span>
            <MarkdownEditor
              v-model="description"
              :workspace-slug="slug"
              label="Template description"
              placeholder="Steps to reproduce..."
              class="max-h-64 min-h-24 overflow-y-auto rounded-md border border-hairline bg-surface-1 px-3 py-2"
            />
          </div>
        </div>
        <div
          class="flex flex-wrap items-center gap-1.5 px-5 pt-3 [&_button]:border [&_button]:border-hairline"
        >
          <StatusPicker v-model="statusId" :statuses="statuses" no-hotkey allow-none />
          <PriorityPicker v-model="priority" no-hotkey />
          <AssigneePicker v-model="assigneeId" :users="assignees" no-hotkey />
          <LabelPicker v-model="labelIds" :labels="labels ?? []" :team-id="scopeTeamId" />
          <ProjectPicker v-model="projectId" :projects="projects ?? []" />
        </div>
        <DialogFooter class="flex-row items-center gap-3 px-5 pt-4 pb-4">
          <p v-if="formError" class="text-[13px] text-danger" role="alert">{{ formError }}</p>
          <Button type="button" variant="ghost" size="sm" class="ml-auto" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" size="sm" :disabled="isSubmitting">
            {{ template ? 'Save' : 'Create template' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
