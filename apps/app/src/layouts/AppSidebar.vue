<script setup lang="ts">
import {
  ChevronRight,
  CircleHelp,
  CircleUser,
  FolderKanban,
  Inbox,
  IterationCcw,
  Layers,
  Search,
  SquarePen,
  SquareStack,
} from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconButton from '@/components/common/IconButton.vue'
import SidebarItem from '@/components/common/SidebarItem.vue'
import SidebarSection from '@/components/common/SidebarSection.vue'
import TeamIcon from '@/components/common/TeamIcon.vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import WorkspaceMenu from '@/features/workspaces/components/WorkspaceMenu.vue'
import { orpc } from '@/lib/orpc'
import { usePreferencesStore } from '@/stores/preferences'
import { useUiStore } from '@/stores/ui'
import { SIDEBAR_SECTIONS, teamSectionKey } from './sidebar-sections'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const preferences = usePreferencesStore()
const { slug } = useCurrentWorkspace()
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

// Unread notifications arrive with the inbox (M10-02); the badge hides at 0.
const unreadCount = 0

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

// Until the command menu (M7-11) lands, Search focuses the issue search field.
async function openSearch() {
  ui.searchFocusRequested = true
  await nextTick()
  if (ui.searchFocusRequested) await router.push(at('issues'))
}

const shortcuts = [{ keys: 'C', label: 'Create issue' }]
</script>

<template>
  <aside class="flex w-56 shrink-0 flex-col gap-3 py-2.5 pr-1 pl-2" aria-label="Sidebar">
    <div class="flex items-center gap-1">
      <div class="flex min-w-0 flex-1">
        <WorkspaceMenu />
      </div>
      <IconButton :icon="Search" label="Search" @click="openSearch" />
      <IconButton
        :icon="SquarePen"
        label="New issue"
        shortcut="C"
        class="bg-panel shadow-panel text-ink-muted hover:bg-surface-3"
        @click="ui.openCreateIssue()"
      />
    </div>

    <nav aria-label="Main" class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div class="grid gap-px">
        <SidebarItem :to="at('inbox')" label="Inbox" :icon="Inbox" :badge="unreadCount" />
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

      <!-- Favorites (M8-07) render here once there is something to show; hidden while empty. -->

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
          </div>
        </div>
        <p v-if="teams && teams.length === 0" class="px-2 text-xs text-ink-tertiary">
          No teams yet
        </p>
      </SidebarSection>
    </nav>

    <div class="flex items-center">
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-ink-subtle"
            aria-label="Help and keyboard shortcuts"
            title="Help"
          >
            <CircleHelp aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <!-- Stand-in until the full shortcuts sheet (M7-11). -->
        <PopoverContent side="top" align="start" class="w-56 p-2">
          <p class="px-1.5 pb-1 text-xs text-ink-subtle">Keyboard shortcuts</p>
          <dl class="grid gap-px">
            <div
              v-for="s in shortcuts"
              :key="s.keys"
              class="flex h-7 items-center justify-between px-1.5"
            >
              <dt class="text-ink">{{ s.label }}</dt>
              <dd>
                <kbd
                  class="inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-hairline-strong px-1 font-sans text-xs text-ink-muted"
                  >{{ s.keys }}</kbd
                >
              </dd>
            </div>
          </dl>
        </PopoverContent>
      </Popover>
    </div>
  </aside>
</template>
