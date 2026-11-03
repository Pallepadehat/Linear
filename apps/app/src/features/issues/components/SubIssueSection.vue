<script setup lang="ts">
import type { IssueDetail, Label } from '@linear/contract'
import { issueTitleSchema } from '@linear/contract'
import { Plus } from '@lucide/vue'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { toast } from 'vue-sonner'
import type { AssigneeOption } from '@/components/common/AssigneePicker.vue'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { projectsKey } from '@/features/projects/queries'
import { issueDetailKeys, issueListKey, useUpdateIssue } from '../queries'
import IssueRow from './IssueRow.vue'
import SubIssueProgressRing from './SubIssueProgressRing.vue'

const props = defineProps<{
  workspaceSlug: string
  issue: IssueDetail
  users: AssigneeOption[]
  labels: Label[]
}>()

const queryClient = useQueryClient()
const updateIssue = useUpdateIssue(() => props.workspaceSlug)

// Each row's status picker offers its own team's statuses (sub-issues may be in other teams).
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: props.workspaceSlug } })),
)
const childTeams = computed(() => {
  const ids = new Set(props.issue.children.map((child) => child.teamId))
  return teams.value?.filter((team) => ids.has(team.id)) ?? []
})
const teamQueries = useQueries({
  queries: computed(() =>
    childTeams.value.map((team) =>
      orpc.teams.get.queryOptions({
        input: { workspaceSlug: props.workspaceSlug, key: team.key },
      }),
    ),
  ),
})
const statusesByTeam = computed(
  () => new Map(teamQueries.value.flatMap((q) => (q.data ? [[q.data.id, q.data.statuses]] : []))),
)

// Inline create: Enter creates and keeps the row open for the next one, Esc closes it.
const creating = ref(false)
const draft = ref('')
const draftError = ref<string | null>(null)
const draftInput = useTemplateRef<HTMLInputElement>('draftInput')
const addButton = useTemplateRef<InstanceType<typeof Button>>('addButton')

async function startCreate() {
  creating.value = true
  await nextTick()
  draftInput.value?.focus()
}
async function cancelCreate() {
  creating.value = false
  draft.value = ''
  draftError.value = null
  await nextTick()
  ;(addButton.value?.$el as HTMLElement | undefined)?.focus()
}

const create = useMutation({
  // The team, status and project come from the parent, like Linear.
  mutationFn: (title: string) =>
    client.issues.create({
      workspaceSlug: props.workspaceSlug,
      teamId: props.issue.teamId,
      statusId: props.issue.status.id,
      projectId: props.issue.projectId,
      parentId: props.issue.id,
      title,
    }),
  onSuccess: () => {
    draft.value = ''
  },
  onError: (error) =>
    toast.error("Couldn't create sub-issue", { description: errorMessage(error) }),
  onSettled: () =>
    Promise.all([
      ...issueDetailKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      queryClient.invalidateQueries({ queryKey: issueListKey() }),
      queryClient.invalidateQueries({ queryKey: orpc.activity.list.key() }),
      queryClient.invalidateQueries({ queryKey: projectsKey() }),
    ]),
})

function submit() {
  if (create.isPending.value) return
  const parsed = issueTitleSchema.safeParse(draft.value)
  if (!parsed.success) {
    draftError.value = parsed.error.issues[0]?.message ?? 'Invalid title'
    return
  }
  draftError.value = null
  create.mutate(parsed.data)
}
</script>

<template>
  <section aria-labelledby="sub-issues-heading" class="mt-4 grid gap-1">
    <div v-if="issue.children.length" class="flex h-8 items-center gap-2">
      <h2 id="sub-issues-heading" class="font-medium text-ink">Sub-issues</h2>
      <span
        v-if="issue.subIssueProgress"
        class="flex items-center gap-1.5 text-xs text-ink-subtle tabular-nums"
      >
        <SubIssueProgressRing v-bind="issue.subIssueProgress" />
        {{ issue.subIssueProgress.done }}/{{ issue.subIssueProgress.total }}
        <span class="sr-only">done</span>
      </span>
    </div>
    <h2 v-else id="sub-issues-heading" class="sr-only">Sub-issues</h2>
    <ul v-if="issue.children.length" class="-mx-2 grid">
      <li v-for="child in issue.children" :key="child.id" class="h-9">
        <IssueRow
          :issue="child"
          :statuses="statusesByTeam.get(child.teamId) ?? []"
          :users="users"
          :labels="labels"
          @update="(patch) => updateIssue.mutate({ issue: child, patch })"
        />
      </li>
    </ul>
    <form v-if="creating" class="grid gap-1" @submit.prevent="submit">
      <label for="sub-issue-title" class="sr-only">Sub-issue title</label>
      <input
        id="sub-issue-title"
        ref="draftInput"
        v-model="draft"
        autocomplete="off"
        placeholder="Sub-issue title"
        :aria-invalid="Boolean(draftError)"
        :aria-describedby="draftError ? 'sub-issue-title-error' : undefined"
        :aria-busy="create.isPending.value"
        class="h-9 rounded-md border border-hairline bg-surface-1 px-3 text-[13px] text-ink caret-primary outline-hidden placeholder:text-ink-tertiary focus-visible:ring-2 focus-visible:ring-ring"
        @keydown.esc.prevent="cancelCreate"
      />
      <p v-if="draftError" id="sub-issue-title-error" class="text-xs text-danger" role="alert">
        {{ draftError }}
      </p>
      <p class="text-xs text-ink-subtle">Enter to create · Esc to cancel</p>
    </form>
    <div v-else>
      <Button
        ref="addButton"
        variant="ghost"
        size="sm"
        class="-ml-2 text-ink-subtle"
        @click="startCreate"
      >
        <Plus aria-hidden="true" />
        Add sub-issues
      </Button>
    </div>
  </section>
</template>
