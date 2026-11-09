<script setup lang="ts">
import {
  ChevronRight,
  CircleHelp,
  CircleUser,
  Command,
  Keyboard,
  FolderKanban,
  IterationCcw,
  Layers,
  Search,
  SquarePen,
  Settings,
  SquareStack,
} from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import IconButton from '@/components/common/IconButton.vue'
import SidebarItem from '@/components/common/SidebarItem.vue'
import SidebarSection from '@/components/common/SidebarSection.vue'
import TeamIcon from '@/components/common/TeamIcon.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import SidebarFavorites from '@/features/favorites/components/SidebarFavorites.vue'
import NotificationsPopover from '@/features/inbox/components/NotificationsPopover.vue'
import WorkspaceMenu from '@/features/workspaces/components/WorkspaceMenu.vue'
import { shortcutKeys } from '@/lib/hotkeys'
import { orpc } from '@/lib/orpc'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiStore } from '@/stores/ui'
import { SIDEBAR_SECTIONS, teamSectionKey } from './sidebar-sections'

const route = useRoute()
const ui = useUiStore()
const preferences = usePreferencesStore()
const { slug } = useCurrentWorkspace()
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

const at = (name: string, params: Record<string, string> = {}) => ({
  name,
  params: { workspaceSlug: slug.value, ...params },
})

// Opening a team page expands that team, like Linear.
watch(
  [() => route.params.teamKey, teams],
  ([teamKey]) => {
    const team = teams.value?.find((t) => t.key === teamKey)
    if (team && !preferences.isExpanded(teamSectionKey(team.id)))
      preferences.setExpanded(teamSectionKey(team.id), true)
  },
  { immediate: true },
)

const commandMenuKeys = shortcutKeys('command-menu').flat().join('')

// In the phone drawer, an action that opens a dialog closes the drawer first.
function openCommandMenu() {
  ui.sidebarOpen = false
  ui.commandMenuOpen = true
}
function openCreateIssue() {
  ui.sidebarOpen = false
  ui.openCreateIssue()
}
function openShortcuts() {
  ui.sidebarOpen = false
  ui.shortcutsOpen = true
}
</script>

<template>
  <aside class="flex flex-col gap-3 py-2.5 pr-1 pl-2" aria-label="Sidebar">
    <div class="flex items-center gap-1">
      <div class="flex min-w-0 flex-1">
        <WorkspaceMenu />
      </div>
      <IconButton
        :icon="Search"
        label="Search"
        :shortcut="commandMenuKeys"
        aria-haspopup="dialog"
        @click="openCommandMenu"
      />
      <IconButton
        :icon="SquarePen"
        label="New issue"
        shortcut="C"
        class="bg-panel shadow-panel text-ink-muted hover:bg-surface-3"
        @click="openCreateIssue"
      />
    </div>

    <nav aria-label="Main" class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div class="grid gap-px">
        <SidebarItem :to="at('my-issues')" label="My issues" :icon="CircleUser" />
      </div>

      <SidebarSection
        label="Workspace"
        :expanded="preferences.isExpanded(SIDEBAR_SECTIONS.workspace)"
        @toggle="preferences.setExpanded(SIDEBAR_SECTIONS.workspace)"
      >
        <SidebarItem :to="at('issues')" label="All issues" :icon="Layers" />
        <SidebarItem :to="at('projects')" label="Projects" :icon="FolderKanban" />
        <SidebarItem :to="at('views')" label="Views" :icon="SquareStack" />
      </SidebarSection>

      <SidebarFavorites />

      <SidebarSection
        label="Your teams"
        :expanded="preferences.isExpanded(SIDEBAR_SECTIONS.teams)"
        @toggle="preferences.setExpanded(SIDEBAR_SECTIONS.teams)"
      >
        <div v-for="team in teams" :key="team.id" class="grid gap-px">
          <button
            type="button"
            class="flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-ink-muted outline-hidden hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            :aria-expanded="preferences.isExpanded(teamSectionKey(team.id))"
            :aria-controls="`sidebar-team-${team.id}`"
            :aria-label="`${team.name} team`"
            @click="preferences.setExpanded(teamSectionKey(team.id))"
          >
            <TeamIcon :name="team.name" />
            <span class="truncate">{{ team.name }}</span>
            <ChevronRight
              class="size-3 shrink-0 text-ink-subtle transition-transform"
              :class="preferences.isExpanded(teamSectionKey(team.id)) && 'rotate-90'"
              aria-hidden="true"
            />
          </button>
          <div
            v-show="preferences.isExpanded(teamSectionKey(team.id))"
            :id="`sidebar-team-${team.id}`"
            class="grid gap-px"
          >
            <SidebarItem
              :to="at('team-issues', { teamKey: team.key })"
              label="Issues"
              :icon="Layers"
              inset
            />
            <SidebarItem
              v-if="team.cyclesEnabled"
              :to="at('cycles', { teamKey: team.key })"
              label="Cycles"
              :icon="IterationCcw"
              inset
            />
            <SidebarItem
              :to="at('team-projects', { teamKey: team.key })"
              label="Projects"
              :icon="FolderKanban"
              inset
            />
            <SidebarItem
              :to="at('team-views', { teamKey: team.key })"
              label="Views"
              :icon="SquareStack"
              inset
            />
            <SidebarItem
              :to="at('team-settings', { teamKey: team.key })"
              label="Settings"
              :icon="Settings"
              inset
            />
          </div>
        </div>
        <p v-if="teams && teams.length === 0" class="px-2 text-xs text-ink-tertiary">
          No teams yet
        </p>
      </SidebarSection>
    </nav>

    <div class="grid gap-px">
      <NotificationsPopover />
      <DropdownMenu>
        <DropdownMenuTrigger
          class="flex h-7 w-full items-center gap-2 rounded-md px-2 text-ink-muted outline-hidden hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-surface-3"
        >
          <CircleHelp class="size-4" aria-hidden="true" />
          Help
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" class="w-60">
          <DropdownMenuItem @select="openCommandMenu">
            <Command class="size-4" aria-hidden="true" />
            Search and commands
            <DropdownMenuShortcut>{{ commandMenuKeys }}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem @select="openShortcuts">
            <Keyboard class="size-4" aria-hidden="true" />
            Keyboard shortcuts
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </aside>
</template>
