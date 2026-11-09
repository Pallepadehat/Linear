<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { onKeyStroke } from '@vueuse/core'
import { computed, defineAsyncComponent, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useHotkeys } from '@/composables/useHotkeys'
import FavoriteButton from '@/features/favorites/components/FavoriteButton.vue'
import { useToggleFavorite } from '@/features/favorites/queries'
import { usePresence } from '@/features/presence/usePresence'
import { useRealtime } from '@/features/realtime/useRealtime'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'
import SidebarDrawer from './SidebarDrawer.vue'
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
const workspaceSlug = () => String(route.params.workspaceSlug ?? '')
const { client: realtimeClient } = useRealtime(workspaceSlug)
// Teammates see that you're online and which issue you're on.
usePresence(workspaceSlug, realtimeClient)

const routeTitle = computed(
  () => [...route.matched].reverse().find((r) => r.meta.title)?.meta.title ?? '',
)
const crumbs = computed(() => ui.breadcrumb ?? [routeTitle.value])
// A page's breadcrumb only applies while it is shown.
watch(
  () => route.path,
  () => {
    ui.breadcrumb = null
    ui.favoriteTarget = null
    ui.sidebarOpen = false
  },
)

// ⌥F toggles the favorite on the page's entity. Matched by key code, not through useHotkeys:
// on macOS ⌥F types "ƒ", so the key never reads "f". Ignored while typing or in a dialog.
const favorites = useToggleFavorite(slug)
onKeyStroke((event) => {
  if (event.code !== 'KeyF' || !event.altKey || event.metaKey || event.ctrlKey) return
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select'))
  )
    return
  if (!ui.favoriteTarget || document.querySelector('[role="dialog"][data-state="open"]')) return
  event.preventDefault()
  favorites.toggle(ui.favoriteTarget)
})

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
  {
    id: 'go-inbox',
    run: () => {
      ui.sidebarOpen = false
      ui.notificationsOpen = !ui.notificationsOpen
    },
  },
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
  <!-- Phones (< md): the sidebar is a drawer and the panel fills the screen. -->
  <div class="flex h-svh bg-app-base text-ink">
    <AppSidebar class="w-56 shrink-0 max-md:hidden" />
    <SidebarDrawer />
    <div
      class="flex min-w-0 flex-1 flex-col overflow-hidden bg-panel md:my-2 md:mr-2 md:rounded-lg md:border md:border-hairline md:shadow-panel"
    >
      <PageHeader :crumbs="crumbs">
        <template #favorite>
          <FavoriteButton />
        </template>
        <template #actions>
          <div
            :id="PANEL_HEADER_ACTIONS.slice(1)"
            class="flex min-w-0 items-center gap-1 md:gap-2"
          />
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
