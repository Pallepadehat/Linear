<script setup lang="ts">
import {
  CircleUser,
  FolderKanban,
  IterationCcw,
  Layers,
  Settings,
  SquarePen,
  Users,
} from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import UserMenu from '@/features/settings/components/UserMenu.vue'
import WorkspaceMenu from '@/features/workspaces/components/WorkspaceMenu.vue'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

const nav = [
  { name: 'my-issues', label: 'My issues', icon: CircleUser },
  { name: 'issues', label: 'All issues', icon: Layers },
  { name: 'projects', label: 'Projects', icon: FolderKanban },
  { name: 'teams', label: 'Teams', icon: Users },
  { name: 'settings', label: 'Settings', icon: Settings },
] as const

const itemClass =
  'flex h-7 items-center gap-2 rounded-md px-2 text-ink-muted hover:bg-surface-3 hover:text-ink aria-[current=page]:bg-surface-4 aria-[current=page]:text-ink'
</script>

<template>
  <aside class="flex w-56 shrink-0 flex-col gap-4 px-2 py-2.5" aria-label="Sidebar">
    <div class="flex items-center justify-between gap-1">
      <WorkspaceMenu />
      <Button
        variant="secondary"
        size="icon-sm"
        class="shrink-0 rounded-full bg-panel shadow-panel"
        aria-label="New issue"
        aria-keyshortcuts="C"
        title="New issue (C)"
        @click="ui.openCreateIssue()"
      >
        <SquarePen aria-hidden="true" />
      </Button>
    </div>
    <nav aria-label="Main" class="grid gap-px">
      <RouterLink
        v-for="item in nav"
        :key="item.name"
        :to="{ name: item.name, params: { workspaceSlug: slug } }"
        :class="itemClass"
      >
        <component :is="item.icon" class="size-4 shrink-0" aria-hidden="true" />
        {{ item.label }}
      </RouterLink>
    </nav>
    <nav aria-labelledby="sidebar-teams" class="grid gap-px">
      <h2 id="sidebar-teams" class="px-2 pb-1 text-xs font-medium text-ink-subtle">Your teams</h2>
      <template v-for="team in teams" :key="team.id">
        <RouterLink
          :to="{ name: 'team', params: { workspaceSlug: slug, teamKey: team.key } }"
          :class="itemClass"
        >
          <span
            class="inline-flex size-4 shrink-0 items-center justify-center rounded-xs bg-surface-4 text-[9px] font-semibold text-ink-muted"
            aria-hidden="true"
            >{{ team.name.charAt(0).toUpperCase() }}</span
          >
          <span class="truncate">{{ team.name }}</span>
        </RouterLink>
        <!-- Until the team sections (Issues / Projects / Views) land, Cycles nests under the team. -->
        <RouterLink
          v-if="team.cyclesEnabled"
          :to="{ name: 'cycles', params: { workspaceSlug: slug, teamKey: team.key } }"
          :class="[itemClass, 'pl-8']"
          :aria-label="`${team.name} cycles`"
        >
          <IterationCcw class="size-4 shrink-0" aria-hidden="true" />
          Cycles
        </RouterLink>
      </template>
      <p v-if="teams && teams.length === 0" class="px-2 text-xs text-ink-tertiary">No teams yet</p>
    </nav>
    <div class="mt-auto">
      <UserMenu />
    </div>
  </aside>
</template>
