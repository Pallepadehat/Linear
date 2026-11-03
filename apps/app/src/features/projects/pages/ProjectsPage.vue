<script setup lang="ts">
import { FolderKanban, Plus } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useRouteTeam } from '@/features/teams/composables/useRouteTeam'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import ProjectProgress from '../components/ProjectProgress.vue'
import { projectStatusMeta } from '../project-status'
import { projectListOptions } from '../queries'

const { slug } = useCurrentWorkspace()
const query = useQuery(computed(() => projectListOptions(slug.value)))
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const teamsById = computed(() => new Map(teams.value?.map((t) => [t.id, t])))

// Also the team projects page (`team/:teamKey/projects`): only that team's projects.
const { team, notFound } = useRouteTeam('Projects')
const projects = computed(() => {
  const all = query.data.value
  if (!all || !team.value) return all
  const teamId = team.value.id
  return all.filter((p) => p.teamIds.includes(teamId))
})

// The dialog lives in the workspace layout so the command menu can open it too.
const ui = useUiStore()
const openCreate = () => (ui.createProjectOpen = true)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline px-4">
      <span class="font-medium text-ink">{{
        team ? `${team.name} projects` : 'All projects'
      }}</span>
      <span v-if="projects" class="text-ink-subtle tabular-nums">
        {{ projects.length }}
      </span>
      <Button size="sm" class="ml-auto" @click="openCreate">
        <Plus aria-hidden="true" />
        New project
      </Button>
    </div>

    <EmptyState v-if="notFound" title="Team not found" />
    <div
      v-else-if="query.isPending.value"
      class="grid pt-2"
      aria-busy="true"
      aria-label="Loading projects"
    >
      <div
        v-for="i in 5"
        :key="i"
        class="mx-2 flex h-11 animate-pulse items-center gap-3 px-3"
        aria-hidden="true"
      >
        <span class="size-4 rounded-xs bg-surface-3" />
        <span class="h-3 rounded-xs bg-surface-3" :style="{ width: `${15 + ((i * 29) % 25)}%` }" />
      </div>
    </div>
    <EmptyState
      v-else-if="query.isError.value"
      title="Couldn't load projects"
      description="Check your connection and try again."
    >
      <Button variant="secondary" size="sm" @click="query.refetch()">Retry</Button>
    </EmptyState>
    <EmptyState
      v-else-if="projects?.length === 0"
      :icon="FolderKanban"
      title="No projects yet"
      description="Projects group related issues across teams."
    >
      <Button size="sm" @click="openCreate">New project</Button>
    </EmptyState>
    <div v-else class="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4">
      <table class="w-full table-fixed border-separate border-spacing-0">
        <caption class="sr-only">
          Projects
        </caption>
        <thead>
          <tr class="h-9 text-left text-xs text-ink-subtle">
            <th scope="col" class="px-3 font-normal">Name</th>
            <th scope="col" class="hidden w-48 px-3 font-normal md:table-cell">Teams</th>
            <th scope="col" class="w-36 px-3 font-normal">Progress</th>
            <th scope="col" class="w-36 px-3 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="project in projects"
            :key="project.id"
            class="group relative h-11 [&>td]:border-t [&>td]:border-hairline [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md hover:[&>td]:bg-surface-2"
          >
            <td class="px-3">
              <RouterLink
                :to="{ name: 'project', params: { workspaceSlug: slug, projectId: project.id } }"
                class="flex min-w-0 items-center gap-2.5 rounded-md outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                <ProjectIcon :src="project.iconUrl" />
                <span class="truncate font-medium text-ink">{{ project.name }}</span>
              </RouterLink>
            </td>
            <td class="hidden px-3 md:table-cell">
              <span class="block truncate text-ink-muted">
                <template v-if="project.teamIds.length === 0">
                  <span class="text-ink-tertiary">—</span>
                </template>
                <template v-else>
                  {{
                    project.teamIds
                      .map((id) => teamsById.get(id)?.name)
                      .filter(Boolean)
                      .join(', ')
                  }}
                </template>
              </span>
            </td>
            <td class="px-3">
              <ProjectProgress :progress="project.progress" />
            </td>
            <td class="px-3">
              <span class="flex items-center gap-2 text-ink-muted">
                <StatusIcon :category="projectStatusMeta(project.status).icon" />
                {{ projectStatusMeta(project.status).label }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
