<script setup lang="ts">
import type { Project } from '@linear/contract'
import { ArrowDown, ArrowUp, FolderKanban, Plus } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MilestoneIcon from '@/components/common/MilestoneIcon.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useRouteTeam } from '@/features/teams/composables/useRouteTeam'
import { PANEL_HEADER_ACTIONS } from '@/layouts/panel-header'
import { toPriority } from '@/lib/priorities'
import { orpc } from '@/lib/orpc'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiStore } from '@/stores/ui'
import HealthIcon from '../components/HealthIcon.vue'
import ProjectDatePicker from '../components/ProjectDatePicker.vue'
import ProjectDisplayMenu from '../components/ProjectDisplayMenu.vue'
import ProjectFilterMenu from '../components/ProjectFilterMenu.vue'
import ProjectLeadPicker from '../components/ProjectLeadPicker.vue'
import { PROJECT_COLUMN_LABELS } from '../project-columns'
import { healthLabel } from '../project-health'
import { sortProjects, toggleProjectSort, type ProjectSortKey } from '../project-sort'
import { progressPercent, projectStatusMeta } from '../project-status'
import { projectListOptions, useUpdateProject, type ProjectChanges } from '../queries'

const { slug } = useCurrentWorkspace()
const { projectSort: sort } = storeToRefs(usePreferencesStore())
const ui = useUiStore()
const { projectStatusFilter: statusFilter } = storeToRefs(ui)

const query = useQuery(computed(() => projectListOptions(slug.value)))
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const membersById = computed(() => new Map(members.value?.map((m) => [m.userId, m])))

// Also the team projects page (`team/:teamKey/projects`): only that team's projects.
const { team, notFound } = useRouteTeam('Projects')
const projects = computed(() => {
  const all = query.data.value
  if (!all || !team.value) return all
  const teamId = team.value.id
  return all.filter((p) => p.teamIds.includes(teamId))
})

const rows = computed(() => {
  const all = projects.value ?? []
  const filtered = statusFilter.value.length
    ? all.filter((p) => statusFilter.value.includes(p.status))
    : all
  return sortProjects(filtered, sort.value, {
    leadName: (id) => membersById.value.get(id)?.name,
  })
})

// Column order and widths; Name takes the rest.
const COLUMNS: { key: ProjectSortKey; class: string }[] = [
  { key: 'name', class: '' },
  { key: 'health', class: 'hidden w-28 lg:table-cell' },
  { key: 'priority', class: 'w-20' },
  { key: 'lead', class: 'w-16' },
  { key: 'targetDate', class: 'hidden w-32 md:table-cell' },
  { key: 'issues', class: 'hidden w-20 md:table-cell' },
  { key: 'status', class: 'w-28' },
]
const ariaSort = (key: ProjectSortKey) =>
  sort.value.key === key ? (sort.value.direction === 'asc' ? 'ascending' : 'descending') : 'none'

const update = useUpdateProject(slug)
function save(project: Project, changes: ProjectChanges) {
  update.mutate({ project, changes })
}

// The dialog lives in the workspace layout so the command menu can open it too.
const openCreate = () => (ui.createProjectOpen = true)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <Teleport defer :to="PANEL_HEADER_ACTIONS">
      <Button size="sm" @click="openCreate">
        <Plus aria-hidden="true" />
        New project
      </Button>
    </Teleport>
    <div class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline px-4">
      <nav aria-label="Project views">
        <span
          aria-current="page"
          class="flex h-7 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-3 text-ink"
        >
          {{ team ? `${team.name} projects` : 'All projects' }}
          <span v-if="projects" class="text-ink-subtle tabular-nums">
            {{ projects.length }}
          </span>
        </span>
      </nav>
      <div class="ml-auto flex items-center gap-1">
        <ProjectFilterMenu v-model="statusFilter" />
        <ProjectDisplayMenu v-model="sort" />
      </div>
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
        class="mx-2 flex h-9 animate-pulse items-center gap-3 px-3"
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
    <EmptyState
      v-else-if="rows.length === 0"
      :icon="FolderKanban"
      title="No matching projects"
      description="No project has the selected status."
    >
      <Button variant="secondary" size="sm" @click="statusFilter = []">Clear filter</Button>
    </EmptyState>
    <div v-else class="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4">
      <table class="w-full table-fixed border-separate border-spacing-0">
        <caption class="sr-only">
          Projects
        </caption>
        <thead>
          <tr class="h-9 text-left text-xs text-ink-subtle">
            <th
              v-for="column in COLUMNS"
              :key="column.key"
              scope="col"
              :aria-sort="ariaSort(column.key)"
              :class="['px-1 font-normal', column.class]"
            >
              <button
                type="button"
                class="flex h-7 items-center gap-1 rounded-md px-2 hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                :class="{ 'text-ink': sort.key === column.key }"
                @click="sort = toggleProjectSort(sort, column.key)"
              >
                {{ PROJECT_COLUMN_LABELS[column.key] }}
                <component
                  :is="sort.direction === 'asc' ? ArrowUp : ArrowDown"
                  v-if="sort.key === column.key"
                  class="size-3"
                  aria-hidden="true"
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="project in rows"
            :key="project.id"
            class="group relative h-9 [&>td]:border-t [&>td]:border-hairline [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md hover:[&>td]:bg-surface-2"
          >
            <td class="px-3">
              <RouterLink
                :to="{ name: 'project', params: { workspaceSlug: slug, projectId: project.id } }"
                class="flex min-w-0 items-center gap-2.5 rounded-md outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                <ProjectIcon :src="project.iconUrl" />
                <span class="truncate font-medium text-ink">{{ project.name }}</span>
                <!-- The current milestone: the first one that isn't complete. -->
                <span
                  v-if="project.currentMilestone"
                  class="flex h-5 max-w-40 shrink-0 items-center gap-1 rounded-full border border-hairline px-1.5 text-xs text-ink-muted"
                  :title="`Current milestone: ${project.currentMilestone.name}`"
                >
                  <MilestoneIcon :progress="project.currentMilestone.progress" />
                  <span class="truncate">{{ project.currentMilestone.name }}</span>
                </span>
              </RouterLink>
            </td>
            <td class="hidden px-3 lg:table-cell">
              <span
                class="flex items-center gap-2"
                :class="project.health ? 'text-ink-muted' : 'text-ink-subtle'"
              >
                <HealthIcon :health="project.health" />
                {{ healthLabel(project.health) }}
              </span>
            </td>
            <!-- Pickers sit above the row link so they open instead of navigating. -->
            <td class="px-1">
              <div class="relative z-10 w-fit">
                <PriorityPicker
                  :model-value="toPriority(project.priority)"
                  compact
                  no-hotkey
                  @update:model-value="(priority) => save(project, { priority })"
                />
              </div>
            </td>
            <td class="px-1">
              <div class="relative z-10 w-fit">
                <ProjectLeadPicker
                  :model-value="project.leadId"
                  :members="members ?? []"
                  compact
                  @update:model-value="(leadId) => save(project, { leadId })"
                />
              </div>
            </td>
            <td class="hidden px-1 md:table-cell">
              <div class="relative z-10 w-fit">
                <ProjectDatePicker
                  :model-value="project.targetDate"
                  label="Target date"
                  compact
                  @update:model-value="(targetDate) => save(project, { targetDate })"
                />
              </div>
            </td>
            <td class="hidden px-3 text-ink-muted tabular-nums md:table-cell">
              {{ project.issueCount }}
            </td>
            <td class="px-3">
              <span
                class="flex items-center gap-2 text-ink-muted tabular-nums"
                :title="projectStatusMeta(project.status).label"
              >
                <StatusIcon :category="projectStatusMeta(project.status).icon" />
                <span class="sr-only">{{ projectStatusMeta(project.status).label }},</span>
                {{ progressPercent(project.progress) }}%
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
