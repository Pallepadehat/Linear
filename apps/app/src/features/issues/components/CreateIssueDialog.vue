<script setup lang="ts">
import { createIssueInputSchema } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Maximize2, Minimize2, X } from '@lucide/vue'
import { useForm } from 'vee-validate'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import AssigneePicker from '@/components/common/AssigneePicker.vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import LabelPicker from '@/components/common/LabelPicker.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
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
const expanded = ref(false)
// Keep the dialog open after creating, for filing several issues in a row.
const createMore = ref(false)
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')
const descriptionEditor = useTemplateRef<InstanceType<typeof MarkdownEditor>>('descriptionEditor')

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
const description = computed({
  get: () => values.description ?? '',
  set: (value: string) => setFieldValue('description', value),
})
const labelIds = computed({
  get: () => values.labelIds ?? [],
  set: (ids: string[]) => setFieldValue('labelIds', ids),
})

// The requested team, else the team page being viewed, else the first team.
function initialTeamId() {
  const list = teams.value ?? []
  const fromRoute = list.find((t) => t.key === route.params.teamKey)
  return ui.createIssueDefaults.teamId ?? fromRoute?.id ?? list[0]?.id ?? ''
}

watch(
  () => ui.createIssueOpen,
  (open) => {
    if (!open) return
    formError.value = null
    resetForm()
    setFieldValue('teamId', initialTeamId())
    setFieldValue('statusId', ui.createIssueDefaults.statusId)
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
    toast.success(`${issue.identifier} created`, { description: issue.title })
    if (!createMore.value) {
      ui.createIssueOpen = false
      return
    }
    // Keep team, status and the other properties; start a fresh title.
    resetForm({ values: { ...form, title: '', description: '', labelIds: [] } })
    await nextTick()
    titleInput.value?.focus()
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
      :show-close-button="false"
      class="top-[12%] translate-y-0 gap-0 rounded-xl border-hairline bg-floating p-0 shadow-floating transition-[max-width] sm:max-w-3xl"
      :class="{ 'sm:max-w-5xl': expanded }"
      @keydown="onKeydown"
      @open-auto-focus.prevent="titleInput?.focus()"
    >
      <form novalidate class="flex flex-col" @submit="onSubmit">
        <div class="flex items-center gap-1.5 px-4 pt-4">
          <div class="[&_button]:border [&_button]:border-hairline">
            <TeamPicker v-if="teams" v-model="teamId" :teams="teams" />
          </div>
          <span class="text-ink-tertiary" aria-hidden="true">›</span>
          <DialogTitle class="text-sm font-normal text-ink">New issue</DialogTitle>
          <div class="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              :aria-label="expanded ? 'Collapse dialog' : 'Expand dialog'"
              @click="expanded = !expanded"
            >
              <Minimize2 v-if="expanded" class="size-4" aria-hidden="true" />
              <Maximize2 v-else class="size-4" aria-hidden="true" />
            </Button>
            <DialogClose as-child>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close">
                <X class="size-4" aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        </div>
        <DialogDescription class="sr-only">
          Create an issue. Press Cmd+Enter to submit.
        </DialogDescription>
        <div class="grid gap-1 px-5 pt-4">
          <label for="new-issue-title" class="sr-only">Issue title</label>
          <input
            id="new-issue-title"
            ref="titleInput"
            v-model="title"
            v-bind="titleAttrs"
            autocomplete="off"
            placeholder="Issue title"
            :aria-invalid="Boolean(errors.title)"
            :aria-describedby="errors.title ? 'new-issue-title-error' : undefined"
            class="w-full bg-transparent text-xl font-semibold tracking-tight text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
            @keydown.enter.exact.prevent="descriptionEditor?.focus()"
          />
          <p
            v-if="errors.title"
            id="new-issue-title-error"
            class="text-xs text-danger"
            role="alert"
          >
            {{ errors.title }}
          </p>
          <MarkdownEditor
            ref="descriptionEditor"
            v-model="description"
            label="Description"
            placeholder="Add description..."
            class="overflow-y-auto py-1"
            :class="expanded ? 'h-[55vh]' : 'max-h-80 min-h-24'"
          />
        </div>
        <div
          class="flex flex-wrap items-center gap-1.5 px-4 pt-2 pb-3 [&_button]:border [&_button]:border-hairline"
        >
          <StatusPicker v-model="statusId" :statuses="statuses" />
          <PriorityPicker v-model="priority" />
          <AssigneePicker v-model="assigneeId" :users="assignees" />
          <LabelPicker v-model="labelIds" :labels="labels ?? []" />
        </div>
        <DialogFooter class="flex-row items-center gap-4 border-t border-hairline px-4 py-3">
          <p v-if="formError || errors.teamId" class="mr-auto text-sm text-danger" role="alert">
            {{ formError ?? 'Pick a team' }}
          </p>
          <label class="ml-auto flex items-center gap-2 text-sm text-ink-subtle">
            <Switch v-model="createMore" />
            Create more
          </label>
          <Button type="submit" :disabled="isSubmitting">Create issue</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
