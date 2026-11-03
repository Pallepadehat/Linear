<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, defineAsyncComponent, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useHotkeys } from '@/composables/useHotkeys'
import { useRealtime } from '@/features/realtime/useRealtime'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'
import { PANEL_HEADER_ACTIONS } from './panel-header'

const CreateIssueDialog = defineAsyncComponent(
  () => import('@/features/issues/components/CreateIssueDialog.vue'),
)
const CreateProjectDialog = defineAsyncComponent(
  () => import('@/features/projects/components/CreateProjectDialog.vue'),
)
const DeleteIssueDialog = defineAsyncComponent(
  () => import('@/features/issues/components/DeleteIssueDialog.vue'),
)
const CommandMenu = defineAsyncComponent(
  () => import('@/features/command/components/CommandMenu.vue'),
)
const ShortcutsSheet = defineAsyncComponent(
  () => import('@/features/command/components/ShortcutsSheet.vue'),
)

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

// Teammates' changes show up live while the workspace is open.
useRealtime(() => String(route.params.workspaceSlug ?? ''))

const routeTitle = computed(
  () => [...route.matched].reverse().find((r) => r.meta.title)?.meta.title ?? '',
)
const crumbs = computed(() => ui.breadcrumb ?? [routeTitle.value])
// A page's breadcrumb only applies while it is shown.
watch(
  () => route.path,
  () => (ui.breadcrumb = null),
)

const go = (name: string, params: Record<string, string> = {}) =>
  void router.push({ name, params: { workspaceSlug: slug.value, ...params } })

// `G T`: the page's team, else the focused/open issue's team (its identifier
// prefix), else the first team.
function currentTeamKey() {
  if (route.params.teamKey) return String(route.params.teamKey)
  const fromIssue = ui.activeIssue?.identifier.split('-')[0]
  const team =
    teams.value?.find((t) => t.key.toUpperCase() === fromIssue?.toUpperCase()) ?? teams.value?.[0]
  return team?.key
}

// Global shortcuts (lib/hotkeys.ts → SHORTCUTS); like Linear, ignored while typing.
useHotkeys([
  {
    id: 'command-menu',
    run: () => {
      if (ui.commandMenuOpen) ui.commandMenuOpen = false
      // Another dialog (create issue, a picker) keeps ⌘K for itself.
      else if (document.querySelector('[role="dialog"][data-state="open"]')) return false
      else ui.commandMenuOpen = true
    },
  },
  {
    id: 'create-issue',
    run: () => {
      if (ui.createIssueOpen) return false
      ui.openCreateIssue()
    },
  },
  { id: 'shortcuts-help', run: () => void (ui.shortcutsOpen = !ui.shortcutsOpen) },
  { id: 'go-inbox', run: () => go('inbox') },
  { id: 'go-my-issues', run: () => go('my-issues') },
  { id: 'go-projects', run: () => go('projects') },
  {
    id: 'go-team-issues',
    run: () => {
      const teamKey = currentTeamKey()
      if (!teamKey) return false
      go('team-issues', { teamKey })
    },
  },
])

// Dialogs load on first use, then stay mounted so they can animate closed.
const loaded = reactive({
  createIssue: false,
  createProject: false,
  deleteIssue: false,
  commandMenu: false,
  shortcuts: false,
})
watch(
  () => [
    ui.createIssueOpen,
    ui.createProjectOpen,
    ui.issueToDelete !== null,
    ui.commandMenuOpen,
    ui.shortcutsOpen,
  ],
  ([createIssue, createProject, deleteIssue, commandMenu, shortcuts]) => {
    loaded.createIssue ||= Boolean(createIssue)
    loaded.createProject ||= Boolean(createProject)
    loaded.deleteIssue ||= Boolean(deleteIssue)
    loaded.commandMenu ||= Boolean(commandMenu)
    loaded.shortcuts ||= Boolean(shortcuts)
  },
)
const createProjectOpen = computed({
  get: () => ui.createProjectOpen,
  set: (value) => (ui.createProjectOpen = value),
})
</script>

<template>
  <!-- Inset shell (design.md → App shell): sidebar on the base, content on a raised panel. -->
  <div class="flex h-svh bg-app-base text-ink">
    <AppSidebar />
    <div
      class="my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-panel shadow-panel"
    >
      <PageHeader :crumbs="crumbs">
        <template #actions>
          <div :id="PANEL_HEADER_ACTIONS.slice(1)" class="flex items-center gap-2" />
        </template>
      </PageHeader>
      <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <RouterView />
      </main>
    </div>
    <CreateIssueDialog v-if="loaded.createIssue" />
    <CreateProjectDialog v-if="loaded.createProject" v-model:open="createProjectOpen" />
    <DeleteIssueDialog v-if="loaded.deleteIssue" />
    <CommandMenu v-if="loaded.commandMenu" />
    <ShortcutsSheet v-if="loaded.shortcuts" />
  </div>
</template>
