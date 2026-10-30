<script setup lang="ts">
import { createIssueInputSchema } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Loader2, Maximize2, Minimize2, Paperclip, X } from '@lucide/vue'
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
// Like Linear, errors show only after pressing Create issue, then clear once fixed.
const [title, titleAttrs] = defineField('title', {
  validateOnBlur: false,
  validateOnModelUpdate: false,
})
watch(title, (value) => {
  if (errors.value.title && value?.trim()) setFieldError('title', undefined)
})

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
  set: (id: string) => setFieldValue('teamId', id, false),
})
const statusId = computed({
  get: () => values.statusId ?? '',
  set: (id: string) => setFieldValue('statusId', id, false),
})
const priority = computed({
  get: () => toPriority(values.priority),
  set: (value: Priority) => setFieldValue('priority', value, false),
})
const assigneeId = computed({
  get: () => values.assigneeId ?? null,
  set: (id: string | null) => setFieldValue('assigneeId', id, false),
})
const description = computed({
  get: () => values.description ?? '',
  set: (value: string) => setFieldValue('description', value, false),
})
const labelIds = computed({
  get: () => values.labelIds ?? [],
  set: (ids: string[]) => setFieldValue('labelIds', ids, false),
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
    setFieldValue('teamId', initialTeamId(), false)
    setFieldValue('statusId', ui.createIssueDefaults.statusId, false)
    ensureStatus()
  },
  { immediate: true },
)
watch(teams, () => {
  if (ui.createIssueOpen && !values.teamId) setFieldValue('teamId', initialTeamId(), false)
})
// Statuses belong to a team, so a team change (or a reset) falls back to that team's default.
// Runs on open too: reopening for the same team doesn't change `statuses`.
function ensureStatus() {
  const list = statuses.value
  if (!list.some((s) => s.id === values.statusId))
    setFieldValue('statusId', defaultStatus(list)?.id, false)
}
watch(statuses, ensureStatus)

const create = useMutation(createIssueMutationOptions())

const pendingUploads = computed(() => descriptionEditor.value?.pendingUploads ?? 0)

const onSubmit = handleSubmit(async (form) => {
  formError.value = null
  // Placeholders aren't real attachment references until their uploads finish.
  if (pendingUploads.value > 0) {
    formError.value = 'Wait for attachments to finish uploading'
    return
  }
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
      class="top-[12%] translate-y-0 gap-0 rounded-xl border-hairline bg-floating p-0 shadow-floating sm:max-w-3xl"
      :class="{ 'top-[6%]': expanded }"
      @keydown="onKeydown"
      @open-auto-focus.prevent="titleInput?.focus()"
    >
      <form
        novalidate
        class="flex flex-col transition-[height]"
        :class="expanded ? 'h-[88vh]' : 'h-auto'"
        @submit="onSubmit"
      >
        <div class="flex items-center gap-1.5 px-4 pt-3.5">
          <div class="[&_button]:border [&_button]:border-hairline">
            <TeamPicker v-if="teams" v-model="teamId" :teams="teams" />
          </div>
          <span class="text-ink-tertiary" aria-hidden="true">›</span>
          <DialogTitle class="text-[13px] font-normal text-ink">New issue</DialogTitle>
          <div class="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              :aria-label="expanded ? 'Collapse dialog' : 'Expand dialog'"
              @click="expanded = !expanded"
            >
              <Minimize2 v-if="expanded" aria-hidden="true" />
              <Maximize2 v-else aria-hidden="true" />
            </Button>
            <DialogClose as-child>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close">
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        </div>
        <DialogDescription class="sr-only">
          Create an issue. Press Cmd+Enter to submit.
        </DialogDescription>
        <div class="flex min-h-0 flex-1 flex-col gap-1 px-5 pt-3">
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
            class="w-full bg-transparent text-lg font-semibold tracking-tight text-ink caret-primary outline-hidden placeholder:text-ink-tertiary"
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
            :workspace-slug="slug"
            label="Description"
            placeholder="Add description..."
            class="overflow-y-auto py-1"
            :class="expanded ? 'min-h-0 flex-1' : 'max-h-80 min-h-24'"
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
        <DialogFooter class="flex-row items-center gap-3 px-4 pt-1 pb-3.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="border border-hairline"
            aria-label="Attach files"
            aria-keyshortcuts="Meta+Shift+U"
            title="Attach files (⌘⇧U)"
            @click="descriptionEditor?.pickFiles('files')"
          >
            <Paperclip aria-hidden="true" />
          </Button>
          <p
            v-if="pendingUploads > 0 && !formError"
            class="flex items-center gap-1.5 text-[13px] text-ink-subtle"
            role="status"
          >
            <Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
            Uploading {{ pendingUploads }} {{ pendingUploads === 1 ? 'file' : 'files' }}…
          </p>
          <p v-if="formError || errors.teamId" class="text-[13px] text-danger" role="alert">
            {{ formError ?? 'Pick a team' }}
          </p>
          <label class="ml-auto flex items-center gap-2 text-[13px] text-ink-subtle">
            <Switch v-model="createMore" />
            Create more
          </label>
          <Button type="submit" size="sm" :disabled="isSubmitting">Create issue</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
