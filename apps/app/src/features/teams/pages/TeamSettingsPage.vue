<script setup lang="ts">
import type { UpdateTeamInput } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import AssigneePicker from '@/components/common/AssigneePicker.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import LabelsSettings from '@/features/labels/components/LabelsSettings.vue'
import { errorCode, errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { toPriority, type Priority } from '@/lib/priorities'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const ui = useUiStore()
const queryClient = useQueryClient()
const { slug, workspace } = useCurrentWorkspace()
const teamKey = computed(() => String(route.params.teamKey))
const teamOptions = computed(() =>
  orpc.teams.get.queryOptions({ input: { workspaceSlug: slug.value, key: teamKey.value } }),
)
const { data: team, error } = useQuery(teamOptions)
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const assignees = computed(
  () => members.value?.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl })) ?? [],
)
const isOwner = computed(() => workspace.value?.role === 'owner')

watchEffect(() => {
  if (team.value) ui.breadcrumb = [team.value.name, 'Settings']
})

type Defaults = Omit<UpdateTeamInput, 'workspaceSlug' | 'key'>

// Optimistic: the picker shows the new value at once and rolls back on failure.
const update = useMutation({
  mutationFn: (defaults: Defaults) =>
    client.teams.update({ workspaceSlug: slug.value, key: teamKey.value, ...defaults }),
  onMutate: async (defaults) => {
    const { queryKey } = teamOptions.value
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData(queryKey)
    if (previous) queryClient.setQueryData(queryKey, { ...previous, ...defaults })
    return { previous }
  },
  onError: (error, _defaults, context) => {
    if (context?.previous) queryClient.setQueryData(teamOptions.value.queryKey, context.previous)
    toast.error(errorMessage(error))
  },
  onSuccess: (saved) => queryClient.setQueryData(teamOptions.value.queryKey, saved),
  // The create dialog reads the same query, so it picks up the new defaults.
  onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.teams.get.key() }),
})

const defaultStatusId = computed({
  get: () => team.value?.defaultStatusId ?? '',
  set: (id: string) => update.mutate({ defaultStatusId: id }),
})
const defaultPriority = computed({
  get: () => toPriority(team.value?.defaultPriority),
  set: (value: Priority) => update.mutate({ defaultPriority: value }),
})
const defaultAssigneeId = computed({
  get: () => team.value?.defaultAssigneeId ?? null,
  set: (id: string | null) => update.mutate({ defaultAssigneeId: id }),
})
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="Team not found" />
  <div v-else-if="team" class="mx-auto grid w-full max-w-3xl gap-8 px-6 py-8">
    <header class="grid gap-1">
      <h1 class="text-lg font-semibold tracking-tight text-ink">{{ team.name }}</h1>
      <p class="font-mono text-xs text-ink-subtle">{{ team.key }}</p>
    </header>
    <section aria-labelledby="issue-defaults-heading" class="grid gap-3">
      <div class="grid gap-1">
        <h2
          id="issue-defaults-heading"
          class="text-xs font-medium tracking-wide text-ink-subtle uppercase"
        >
          Issue defaults
        </h2>
        <p class="text-ink-subtle">
          Used for new issues in this team when no value is picked.
          <template v-if="workspace && !isOwner">Only workspace owners can change them.</template>
        </p>
      </div>
      <div
        class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1"
        :class="{ 'pointer-events-none opacity-60': !isOwner }"
        :inert="!isOwner || undefined"
      >
        <div class="flex items-center justify-between gap-4 px-4 py-2">
          <span class="text-ink-muted">Status</span>
          <StatusPicker v-model="defaultStatusId" :statuses="team.statuses" no-hotkey />
        </div>
        <div class="flex items-center justify-between gap-4 px-4 py-2">
          <span class="text-ink-muted">Priority</span>
          <PriorityPicker v-model="defaultPriority" no-hotkey />
        </div>
        <div class="flex items-center justify-between gap-4 px-4 py-2">
          <span class="text-ink-muted">Assignee</span>
          <AssigneePicker v-model="defaultAssigneeId" :users="assignees" no-hotkey />
        </div>
      </div>
    </section>
    <section aria-labelledby="team-labels-heading" class="grid gap-3">
      <div class="grid gap-1">
        <h2
          id="team-labels-heading"
          class="text-xs font-medium tracking-wide text-ink-subtle uppercase"
        >
          Labels
        </h2>
        <p class="text-ink-subtle">Only issues in {{ team.name }} can use these labels.</p>
      </div>
      <LabelsSettings :team-id="team.id" />
    </section>
  </div>
</template>
