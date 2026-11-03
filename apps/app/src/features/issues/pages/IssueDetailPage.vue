<script setup lang="ts">
import { issueTitleSchema } from '@linear/contract'
import { SearchX } from '@lucide/vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, useTemplateRef, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { issuePullRequestsOptions } from '@/features/github/queries'
import { projectListOptions } from '@/features/projects/queries'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import CommentComposer from '../components/CommentComposer.vue'
import IssueProperties from '../components/IssueProperties.vue'
import IssueTimeline from '../components/IssueTimeline.vue'
import type { IssuePatch } from '../issue-cache'
import { buildTimeline, type ActivityNames } from '../issue-timeline'
import {
  activityListOptions,
  commentListOptions,
  issueByIdentifierOptions,
  useUpdateIssue,
} from '../queries'

const route = useRoute()
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const identifier = computed(() => String(route.params.identifier))

const issueQuery = useQuery(computed(() => issueByIdentifierOptions(slug.value, identifier.value)))
const issue = issueQuery.data
// A malformed identifier fails input validation; to the user it's just not found.
const notFound = computed(() =>
  ['NOT_FOUND', 'BAD_REQUEST'].includes(errorCode(issueQuery.error.value) ?? ''),
)

// Lookups for the pickers and for naming ids in the activity log.
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const team = computed(() => teams.value?.find((t) => t.id === issue.value?.teamId))
const { data: teamWithStatuses } = useQuery(
  computed(() => ({
    ...orpc.teams.get.queryOptions({
      input: { workspaceSlug: slug.value, key: team.value?.key ?? '' },
    }),
    enabled: Boolean(team.value),
  })),
)
const statuses = computed(() => teamWithStatuses.value?.statuses ?? [])
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const users = computed(
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

const names = computed<ActivityNames>(() => {
  const byId = <T extends { id: string; name: string }>(list: T[] | undefined) => {
    const map = new Map(list?.map((item) => [item.id, item.name]))
    return (id: string) => map.get(id)
  }
  return {
    status: byId(statuses.value),
    user: byId(users.value),
    project: byId(projects.value),
    label: byId(labels.value),
  }
})
const avatarOf = (userId: string) => users.value.find((u) => u.id === userId)?.avatarUrl ?? null

watchEffect(() => {
  if (issue.value) ui.breadcrumb = [team.value?.name ?? 'Issues', issue.value.identifier]
})

// Comments and activity are paged; an issue's history is small, so load all of it.
const issueId = computed(() => issue.value?.id ?? '')
const comments = useInfiniteQuery(
  computed(() => ({
    ...commentListOptions(slug.value, issueId.value),
    enabled: Boolean(issue.value),
  })),
)
const activity = useInfiniteQuery(
  computed(() => ({
    ...activityListOptions(slug.value, issueId.value),
    enabled: Boolean(issue.value),
  })),
)
watchEffect(() => {
  for (const query of [comments, activity]) {
    if (query.hasNextPage.value && !query.isFetchingNextPage.value) void query.fetchNextPage()
  }
})
const { data: pullRequests } = useQuery(
  computed(() => ({
    ...issuePullRequestsOptions(slug.value, issueId.value),
    enabled: Boolean(issue.value),
  })),
)
// GitHub activity links to its PR while that PR is still linked.
const pullRequestOf = (id: string) => pullRequests.value?.find((pr) => pr.id === id)
const timeline = computed(() =>
  buildTimeline(
    comments.data.value?.pages.flatMap((p) => p.items) ?? [],
    activity.data.value?.pages.flatMap((p) => p.items) ?? [],
  ),
)

// Shared with the issue list: optimistic, rolled back with a toast on error.
const updateIssue = useUpdateIssue(slug)
function save(patch: IssuePatch) {
  if (issue.value) updateIssue.mutate({ issue: issue.value, patch })
}

// Title and description are drafts while focused, saved on blur (Enter for the title).
const titleDraft = ref('')
const titleError = ref<string | null>(null)
const descriptionDraft = ref('')
const descriptionEditor = useTemplateRef<InstanceType<typeof MarkdownEditor>>('descriptionEditor')
watch(
  () => issue.value?.id,
  () => {
    titleDraft.value = issue.value?.title ?? ''
    descriptionDraft.value = issue.value?.description ?? ''
    titleError.value = null
  },
  { immediate: true },
)

function commitTitle() {
  if (!issue.value) return
  const parsed = issueTitleSchema.safeParse(titleDraft.value)
  if (!parsed.success) {
    titleError.value = parsed.error.issues[0]?.message ?? 'Invalid title'
    return
  }
  titleError.value = null
  titleDraft.value = parsed.data
  if (parsed.data !== issue.value.title) save({ title: parsed.data })
}
function revertTitle(event: KeyboardEvent) {
  titleDraft.value = issue.value?.title ?? ''
  titleError.value = null
  ;(event.target as HTMLTextAreaElement).blur()
}

function commitDescription() {
  if (!issue.value) return
  // Placeholders aren't valid attachment references until their uploads finish.
  if ((descriptionEditor.value?.pendingUploads ?? 0) > 0) return
  const next = descriptionDraft.value.trim() ? descriptionDraft.value : null
  if (next !== issue.value.description) save({ description: next })
}
function onDescriptionFocusOut(event: FocusEvent) {
  const to = event.relatedTarget
  if (to instanceof Node && (event.currentTarget as HTMLElement).contains(to)) return
  commitDescription()
}
// Uploads that finish after the editor lost focus still get saved.
watch(
  () => descriptionEditor.value?.pendingUploads,
  (pending) => {
    if (pending === 0) commitDescription()
  },
)
// Leaving the page while editing still saves.
onBeforeUnmount(commitDescription)
</script>

<template>
  <EmptyState
    v-if="notFound"
    :icon="SearchX"
    title="Issue not found"
    description="It may have been deleted, or you don't have access to it."
  >
    <Button as-child variant="secondary" size="sm">
      <RouterLink :to="{ name: 'issues', params: { workspaceSlug: slug } }">
        Back to issues
      </RouterLink>
    </Button>
  </EmptyState>
  <EmptyState
    v-else-if="issueQuery.isError.value"
    title="Couldn't load issue"
    description="Check your connection and try again."
  >
    <Button variant="secondary" size="sm" @click="issueQuery.refetch()">Retry</Button>
  </EmptyState>
  <div
    v-else-if="issue"
    class="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_288px] lg:overflow-hidden"
  >
    <article class="min-w-0 lg:overflow-y-auto">
      <div class="mx-auto grid max-w-3xl gap-2 px-8 pt-8 pb-12">
        <p class="font-mono text-xs text-ink-subtle">{{ issue.identifier }}</p>
        <label for="issue-title" class="sr-only">Issue title</label>
        <textarea
          id="issue-title"
          v-model="titleDraft"
          rows="1"
          autocomplete="off"
          :aria-invalid="Boolean(titleError)"
          :aria-describedby="titleError ? 'issue-title-error' : undefined"
          class="-mx-1 field-sizing-content resize-none rounded-md bg-transparent px-1 text-2xl font-semibold tracking-tight text-ink caret-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          @blur="commitTitle"
          @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
          @keydown.esc.prevent="revertTitle"
        />
        <p v-if="titleError" id="issue-title-error" class="text-xs text-danger" role="alert">
          {{ titleError }}
        </p>
        <div class="-mx-1 rounded-md px-1" @focusout="onDescriptionFocusOut">
          <MarkdownEditor
            ref="descriptionEditor"
            v-model="descriptionDraft"
            :workspace-slug="slug"
            label="Description"
            placeholder="Add description..."
            class="min-h-16 py-1"
          />
        </div>

        <section aria-labelledby="activity-heading" class="mt-8 grid gap-4">
          <h2 id="activity-heading" class="border-t border-hairline pt-6 font-medium text-ink">
            Activity
          </h2>
          <div
            v-if="comments.isPending.value || activity.isPending.value"
            class="h-12 animate-pulse rounded-lg bg-surface-2"
            aria-busy="true"
            aria-label="Loading activity"
          />
          <IssueTimeline
            v-else
            :entries="timeline"
            :names="names"
            :avatar-of="avatarOf"
            :pull-request-of="pullRequestOf"
          />
          <CommentComposer :workspace-slug="slug" :issue-id="issue.id" />
        </section>
      </div>
    </article>
    <IssueProperties
      class="lg:overflow-y-auto"
      :issue="issue"
      :statuses="statuses"
      :users="users"
      :labels="labels ?? []"
      :projects="projects ?? []"
      :pull-requests="pullRequests"
      @change="save"
    />
  </div>
</template>
