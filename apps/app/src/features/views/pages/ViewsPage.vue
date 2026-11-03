<script setup lang="ts">
import { Layers } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useRouteTeam } from '@/features/teams/composables/useRouteTeam'
import { orpc } from '@/lib/orpc'
import ViewIcon from '../components/ViewIcon.vue'
import ViewMenu from '../components/ViewMenu.vue'
import { viewListOptions } from '../queries'

// Serves both the workspace (every view) and the team views route (that team's views).
const { slug } = useCurrentWorkspace()
const { team, teamKey, notFound } = useRouteTeam('Views')
const query = useQuery(
  computed(() => ({
    ...viewListOptions(slug.value, team.value?.id),
    // Wait for the team before listing, or the team page would flash every view.
    enabled: !teamKey.value || Boolean(team.value),
  })),
)
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const teamName = (id: string | null) =>
  id ? (teams.value?.find((t) => t.id === id)?.name ?? 'Team') : 'Workspace'
const issuesRoute = computed(() =>
  team.value
    ? { name: 'team-issues', params: { workspaceSlug: slug.value, teamKey: team.value.key } }
    : { name: 'issues', params: { workspaceSlug: slug.value } },
)
</script>

<template>
  <EmptyState v-if="notFound" title="Team not found" />
  <div
    v-else-if="query.isPending.value"
    class="grid pt-2"
    aria-busy="true"
    aria-label="Loading views"
  >
    <div
      v-for="i in 4"
      :key="i"
      class="mx-2 flex h-9 animate-pulse items-center gap-3 px-3"
      aria-hidden="true"
    >
      <span class="size-4 rounded-xs bg-surface-3" />
      <span class="h-3 rounded-xs bg-surface-3" :style="{ width: `${15 + ((i * 29) % 25)}%` }" />
    </div>
  </div>
  <EmptyState
    v-else-if="query.isError.value"
    title="Couldn't load views"
    description="Check your connection and try again."
  >
    <Button variant="secondary" size="sm" @click="query.refetch()">Retry</Button>
  </EmptyState>
  <EmptyState
    v-else-if="query.data.value?.length === 0"
    :icon="Layers"
    title="No views yet"
    description="Filter an issue list, then use the layers button to save it as a view."
  >
    <Button variant="secondary" size="sm" @click="$router.push(issuesRoute)">Go to issues</Button>
  </EmptyState>
  <div v-else class="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4">
    <table class="w-full table-fixed border-separate border-spacing-0">
      <caption class="sr-only">
        Views
      </caption>
      <thead>
        <tr class="h-9 text-left text-xs text-ink-subtle">
          <th scope="col" class="px-3 font-normal">Name</th>
          <th scope="col" class="w-20 px-3 font-normal">Owner</th>
          <th scope="col" class="w-36 px-3 font-normal">Scope</th>
          <th scope="col" class="w-12"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="view in query.data.value"
          :key="view.id"
          class="group relative h-9 [&>td]:border-t [&>td]:border-hairline [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md hover:[&>td]:bg-surface-2"
        >
          <td class="px-3">
            <RouterLink
              :to="{ name: 'view', params: { workspaceSlug: slug, viewId: view.id } }"
              class="flex min-w-0 items-center gap-2.5 rounded-md outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              <ViewIcon :icon="view.icon" :color="view.color" />
              <span class="truncate font-medium text-ink">{{ view.name }}</span>
              <span v-if="!view.shared" class="shrink-0 text-xs text-ink-subtle">Private</span>
            </RouterLink>
          </td>
          <td class="px-3">
            <UserAvatar
              :name="view.owner.name"
              :src="view.owner.avatarUrl"
              :title="view.owner.name"
            />
          </td>
          <td class="truncate px-3 text-ink-muted">{{ teamName(view.teamId) }}</td>
          <td class="px-1">
            <div class="relative z-10 flex justify-end">
              <ViewMenu :view="view" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
