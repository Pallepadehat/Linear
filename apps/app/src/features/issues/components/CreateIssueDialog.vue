<script setup lang="ts">
import { createIssueInputSchema } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useForm } from 'vee-validate'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import AssigneePicker from '@/components/common/AssigneePicker.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
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
import { errorMessage } from '@/lib/errors'
import { toTypedSchema } from '@/lib/form-schema'
import { orpc } from '@/lib/orpc'
import { toPriority, type Priority } from '@/lib/priorities'
import { useUiStore } from '@/stores/ui'
import { defaultStatus } from '../default-status'
import { createIssueMutationOptions, issueListKey } from '../queries'
import TeamPicker from './TeamPicker.vue'

const ui = useUiStore()
const route = useRoute()
const queryClient = useQueryClient()
const { slug } = useCurrentWorkspace()
const formError = ref<string | null>(null)

const { handleSubmit, isSubmitting, values, errors, setFieldValue, resetForm, defineField } =
  useForm({
    validationSchema: toTypedSchema(createIssueInputSchema.omit({ workspaceSlug: true })),
    initialValues: {
      teamId: '',
      title: '',
      description: '',
      statusId: undefined,
      priority: 0,
      assigneeId: null,
      labelIds: [],
    },
  })
const [title, titleAttrs] = defineField('title')
const [description] = defineField('description')

const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const team = computed(() => teams.value?.find((t) => t.id === values.teamId))
const { data: teamWithStatuses } = useQuery(
  computed(() => ({
    ...orpc.teams.get.queryOptions({
      input: { workspaceSlug: slug.value, key: team.value?.key ?? '' },
    }),
    enabled: Boolean(team.value),
  })),
)
const statuses = computed(() =>
  teamWithStatuses.value?.id === values.teamId ? teamWithStatuses.value.statuses : [],
)
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const assignees = computed(
  () => members.value?.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl })) ?? [],
)
const { data: labels } = useQuery(
  computed(() => orpc.labels.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

// The pickers want concrete values; the form keeps the contract's optional shape.
const teamId = computed({
  get: () => values.teamId ?? '',
  set: (id: string) => setFieldValue('teamId', id),
})
const statusId = computed({
  get: () => values.statusId ?? '',
  set: (id: string) => setFieldValue('statusId', id),
})
const priority = computed({
  get: () => toPriority(values.priority),
  set: (value: Priority) => setFieldValue('priority', value),
})
const assigneeId = computed({
  get: () => values.assigneeId ?? null,
  set: (id: string | null) => setFieldValue('assigneeId', id),
})
const labelIds = computed({
  get: () => values.labelIds ?? [],
  set: (ids: string[]) => setFieldValue('labelIds', ids),
})

// The requested team, else the team page being viewed, else the first team.
function initialTeamId() {
  const list = teams.value ?? []
  const fromRoute = list.find((t) => t.key === route.params.teamKey)
  return ui.createIssueTeamId ?? fromRoute?.id ?? list[0]?.id ?? ''
}

watch(
  () => ui.createIssueOpen,
  (open) => {
    if (!open) return
    formError.value = null
    resetForm()
    setFieldValue('teamId', initialTeamId())
  },
  { immediate: true },
)
watch(teams, () => {
  if (ui.createIssueOpen && !values.teamId) setFieldValue('teamId', initialTeamId())
})
// Statuses belong to a team, so a team change resets the status to that team's default.
watch(statuses, (list) => {
  if (!list.some((s) => s.id === values.statusId))
    setFieldValue('statusId', defaultStatus(list)?.id)
})

const create = useMutation(createIssueMutationOptions())

const onSubmit = handleSubmit(async (form) => {
  formError.value = null
  try {
    const issue = await create.mutateAsync({
      ...form,
      workspaceSlug: slug.value,
      description: form.description?.trim() ? form.description : undefined,
    })
    await queryClient.invalidateQueries({ queryKey: issueListKey() })
    ui.createIssueOpen = false
    toast.success(`${issue.identifier} created`, { description: issue.title })
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
  <Dialog v-model:open="ui.createIssueOpen">
    <DialogContent
      class="top-[15%] translate-y-0 gap-0 overflow-hidden border-hairline bg-floating p-0 shadow-floating sm:max-w-2xl"
      @keydown="onKeydown"
    >
      <form novalidate @submit="onSubmit">
        <div class="flex items-center gap-1 px-4 pt-3 pr-12">
          <TeamPicker v-if="teams" v-model="teamId" :teams="teams" />
          <span class="text-ink-tertiary" aria-hidden="true">›</span>
          <DialogTitle class="text-sm font-normal text-ink">New issue</DialogTitle>
        </div>
        <DialogDescription class="sr-only">
          Create an issue. Press Cmd+Enter to submit.
        </DialogDescription>
        <div class="grid gap-1 px-5 pt-3">
          <label for="new-issue-title" class="sr-only">Issue title</label>
          <input
            id="new-issue-title"
            v-model="title"
            v-bind="titleAttrs"
            autofocus
            autocomplete="off"
            placeholder="Issue title"
            :aria-invalid="Boolean(errors.title)"
            :aria-describedby="errors.title ? 'new-issue-title-error' : undefined"
            class="w-full bg-transparent text-lg font-medium text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
          />
          <p
            v-if="errors.title"
            id="new-issue-title-error"
            class="text-xs text-danger"
            role="alert"
          >
            {{ errors.title }}
          </p>
          <label for="new-issue-description" class="sr-only">Description</label>
          <textarea
            id="new-issue-description"
            v-model="description"
            placeholder="Add description..."
            class="field-sizing-content max-h-80 min-h-20 w-full resize-none bg-transparent py-1 text-sm text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
          />
        </div>
        <div class="flex flex-wrap items-center gap-1 px-4 py-2">
          <StatusPicker v-model="statusId" :statuses="statuses" />
          <PriorityPicker v-model="priority" />
          <AssigneePicker v-model="assigneeId" :users="assignees" />
          <LabelPicker v-model="labelIds" :labels="labels ?? []" />
        </div>
        <DialogFooter class="items-center border-t border-hairline px-4 py-3">
          <p v-if="formError || errors.teamId" class="mr-auto text-sm text-danger" role="alert">
            {{ formError ?? 'Pick a team' }}
          </p>
          <Button type="submit" size="sm" :disabled="isSubmitting">Create issue</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
