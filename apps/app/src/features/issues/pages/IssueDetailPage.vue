<script setup lang="ts">
import { issueTitleSchema } from '@linear/contract'
import type { Issue, IssueLink } from '@linear/contract'
import { SearchX } from '@lucide/vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, ref, useTemplateRef, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import MarkdownEditor from '@/components/common/editor/MarkdownEditor.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { cycleListOptions } from '@/features/cycles/queries'
import { cycleName } from '@/features/cycles/cycles'
import { useHotkeys } from '@/composables/useHotkeys'
import { isMacPlatform, shortcutKeys } from '@/lib/hotkeys'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { issuePullRequestsOptions } from '@/features/github/queries'
import IssueViewers from '@/features/presence/components/IssueViewers.vue'
import { useViewingIssue } from '@/features/presence/usePresence'
import { projectListOptions } from '@/features/projects/queries'
import { estimateLabel } from '@/lib/estimates'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import CommentComposer from '../components/CommentComposer.vue'
import IssueDetailHeader from '../components/IssueDetailHeader.vue'
import IssueProperties from '../components/IssueProperties.vue'
import IssueLinkDialog from '../components/IssueLinkDialog.vue'
import IssueRelations from '../components/IssueRelations.vue'
import IssueResources from '../components/IssueResources.vue'
import IssueSearchDialog from '../components/IssueSearchDialog.vue'
import IssueTimeline from '../components/IssueTimeline.vue'
import ParentIssueDialog from '../components/ParentIssueDialog.vue'
import SubIssueSection from '../components/SubIssueSection.vue'
import SubscribeButton from '../components/SubscribeButton.vue'
import type { IssuePatch } from '../issue-cache'
import { buildTimeline, type ActivityNames } from '../issue-timeline'
import {
  activityListOptions,
  commentListOptions,
  issueByIdentifierOptions,
  issueSubscribersOptions,
  useCreateRelation,
  useIssueSubscription,
  useUpdateIssue,
} from '../queries'
import { RELATION_KINDS, relationFor, type RelationKind } from '../relation-kinds'

// The Inbox embeds this page for the selected notification's issue; standalone, the
// identifier comes from the route.
const props = defineProps<{ identifier?: string; embedded?: boolean }>()

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const identifier = computed(() => props.identifier ?? String(route.params.identifier))

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
const { data: cycles } = useQuery(
  computed(() => ({
    ...cycleListOptions(slug.value, issue.value?.teamId ?? ''),
    enabled: Boolean(teamWithStatuses.value?.cyclesEnabled || issue.value?.cycleId),
  })),
)

const names = computed<ActivityNames>(() => {
  const byId = <T extends { id: string; name: string }>(list: T[] | undefined) => {
    const map = new Map(list?.map((item) => [item.id, item.name]))
    return (id: string) => map.get(id)
  }
  return {
    status: byId(statuses.value),
    user: byId(users.value),
    project: byId(projects.value),
    cycle: byId(cycles.value?.map((c) => ({ id: c.id, name: cycleName(c) }))),
    label: byId(labels.value),
    estimate:
      team.value?.estimateScale === 'tshirt' ? (v) => estimateLabel(v, 'tshirt') : undefined,
  }
})
const estimates = computed(() =>
  team.value ? { scale: team.value.estimateScale, allowZero: team.value.estimateAllowZero } : null,
)
const avatarOf = (userId: string) => users.value.find((u) => u.id === userId)?.avatarUrl ?? null

// The open issue is the command menu's context; Esc goes back (⌘⌫ is in the header).
watch(
  issue,
  (current) => {
    ui.activeIssue = current ? { id: current.id, identifier: current.identifier } : null
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (ui.activeIssue?.id === issue.value?.id) ui.activeIssue = null
})
useHotkeys([
  {
    id: 'issue-back',
    run: () => {
      if (props.embedded) return false
      // Back to where the issue was opened from; a direct link falls back to its team.
      if (window.history.state?.back) router.back()
      else if (team.value)
        void router.push({ name: 'team-issues', params: { teamKey: team.value.key } })
      else void router.push({ name: 'issues' })
    },
  },
])

const currentUser = useCurrentUser()

// Teammates see that you're on this issue (presence heartbeats).
useViewingIssue(() => issue.value?.id)

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

// "Set parent issue…" (⇧⌘P, Ctrl on other platforms) and "Remove parent".
const parentDialogOpen = ref(false)
useHotkeys([
  {
    id: 'issue-set-parent',
    run: () => {
      if (issue.value) parentDialogOpen.value = true
    },
  },
])
function setParent(parent: Issue) {
  save({
    parentId: parent.id,
    parent: {
      id: parent.id,
      identifier: parent.identifier,
      title: parent.title,
      status: parent.status,
    },
  })
}

// Ctrl L (and "…" → Add link…) adds a link; the resources list edits one.
const linkDialogOpen = ref(false)
const editingLink = ref<IssueLink | null>(null)
function openLinkDialog(link: IssueLink | null = null) {
  editingLink.value = link
  linkDialogOpen.value = true
}
useHotkeys([
  {
    id: 'issue-add-link',
    run: () => {
      if (issue.value) openLinkDialog()
    },
  },
])
const addLinkShortcut = shortcutKeys('issue-add-link')
  .flat()
  .join(isMacPlatform() ? '' : ' ')

// "…" → Mark as ▸ opens the issue search; picking an issue creates the relation.
const relationKind = ref<RelationKind | null>(null)
const pickingRelation = computed({
  get: () => relationKind.value !== null,
  set: (open: boolean) => {
    if (!open) relationKind.value = null
  },
})
const relationTitle = computed(
  () => RELATION_KINDS.find((k) => k.kind === relationKind.value)?.title ?? '',
)
const createRelation = useCreateRelation(slug)
function relate(other: Issue) {
  if (issue.value && relationKind.value)
    createRelation.mutate(relationFor(relationKind.value, issue.value.id, other.id))
}

const { data: me } = useCurrentUser()
const { data: subscribers } = useQuery(
  computed(() => ({
    ...issueSubscribersOptions(slug.value, issueId.value),
    enabled: Boolean(issue.value),
  })),
)
const subscription = useIssueSubscription(slug)
function setSubscribed(
  user: { id: string; name: string; avatarUrl: string | null },
  subscribe: boolean,
) {
  if (!issue.value) return
  const member = members.value?.find((m) => m.userId === user.id)
  subscription.mutate({
    issue: issue.value,
    user: { id: user.id, name: user.name, email: member?.email ?? '', avatarUrl: user.avatarUrl },
    subscribe,
    isMe: user.id === me.value?.id,
  })
}
function toggleMySubscription() {
  if (issue.value && me.value) setSubscribed(me.value, !issue.value.isSubscribed)
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
    <IssueDetailHeader
      :workspace-slug="slug"
      :issue="issue"
      :team-name="team?.name"
      :team-key="team?.key"
      @change="save"
      @set-parent="parentDialogOpen = true"
      @mark-as="relationKind = $event"
      @add-link="openLinkDialog()"
    >
      <SubscribeButton :subscribed="issue.isSubscribed" @toggle="toggleMySubscription" />
    </IssueDetailHeader>
    <article class="min-w-0 lg:overflow-y-auto">
      <div class="mx-auto grid max-w-3xl gap-2 px-8 pt-8 pb-12">
        <div class="flex h-7 items-center gap-2">
          <p class="font-mono text-xs text-ink-subtle">{{ issue.identifier }}</p>
          <span class="flex-1" aria-hidden="true" />
          <IssueViewers :issue-id="issue.id" />
        </div>
        <RouterLink
          v-if="issue.parent"
          :to="{ name: 'issue', params: { identifier: issue.parent.identifier } }"
          class="-mx-1 flex h-6 max-w-full items-center gap-1.5 self-start rounded-md px-1 text-[13px] text-ink-subtle outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span class="sr-only">Parent issue:</span>
          <StatusIcon :category="issue.parent.status.category" />
          <span class="font-mono text-xs">{{ issue.parent.identifier }}</span>
          <span class="truncate">{{ issue.parent.title }}</span>
        </RouterLink>
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
        <IssueResources
          :workspace-slug="slug"
          :issue-id="issue.id"
          :links="issue.links"
          :pull-requests="pullRequests"
          :add-shortcut="addLinkShortcut"
          @add="openLinkDialog()"
          @edit="openLinkDialog"
        />
        <IssueRelations :issue="issue" :workspace-slug="slug" />

        <SubIssueSection
          :workspace-slug="slug"
          :issue="issue"
          :users="users"
          :labels="labels ?? []"
        />

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
            :workspace-slug="slug"
            :issue-id="issue.id"
            :current-user-id="currentUser.data.value?.id"
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
      :cycles="cycles ?? []"
      :cycles-enabled="teamWithStatuses?.cyclesEnabled"
      :estimates="estimates"
      :pull-requests="pullRequests"
      :subscribers="subscribers ?? []"
      @change="save"
      @subscription="setSubscribed"
    />
    <IssueSearchDialog
      v-model:open="pickingRelation"
      :workspace-slug="slug"
      :title="relationTitle"
      :exclude-ids="[issue.id]"
      @select="relate"
    />
    <IssueLinkDialog
      v-model:open="linkDialogOpen"
      :workspace-slug="slug"
      :issue-id="issue.id"
      :link="editingLink"
    />
    <ParentIssueDialog
      v-model:open="parentDialogOpen"
      :workspace-slug="slug"
      :issue-id="issue.id"
      :current-parent-id="issue.parentId"
      @select="setParent"
    />
  </div>
</template>
