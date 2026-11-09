<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Ellipsis, FolderKanban, IterationCcw, Layers, Settings, SquareStack } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import IconButton from '@/components/common/IconButton.vue'
import TeamIcon from '@/components/common/TeamIcon.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import SettingsSection from '@/features/settings/components/SettingsSection.vue'
import { orpc } from '@/lib/orpc'
import CreateTeamForm from '../components/CreateTeamForm.vue'

const router = useRouter()
const { slug, workspace } = useCurrentWorkspace()
const { data: teams, isPending } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)

const at = (name: string, teamKey: string) => ({
  name,
  params: { workspaceSlug: slug.value, teamKey },
})
</script>

<template>
  <div class="mx-auto grid w-full max-w-3xl content-start gap-8 px-4 pt-6 pb-16 md:px-8 md:pt-8">
    <header class="grid gap-1">
      <h1 class="text-lg font-semibold tracking-tight text-ink">Teams</h1>
      <p class="text-ink-subtle">
        Teams own issues, cycles and their own labels{{ workspace ? ` in ${workspace.name}` : '' }}.
      </p>
    </header>

    <SettingsSection id="all-teams" title="All teams">
      <ul class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1">
        <li v-if="isPending" class="px-4 py-3 text-ink-subtle">Loading…</li>
        <li v-else-if="teams?.length === 0" class="px-4 py-3 text-ink-subtle">
          No teams yet. Create the first one below.
        </li>
        <li
          v-for="team in teams"
          :key="team.id"
          class="flex items-center gap-2 pr-2 first:rounded-t-lg last:rounded-b-lg hover:bg-surface-2"
        >
          <RouterLink
            :to="at('team-issues', team.key)"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-md py-3 pl-4 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TeamIcon :name="team.name" />
            <span class="truncate font-medium text-ink">{{ team.name }}</span>
            <span class="shrink-0 font-mono text-xs text-ink-subtle">{{ team.key }}</span>
          </RouterLink>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <IconButton
                :icon="Ellipsis"
                :label="`${team.name} actions`"
                class="data-[state=open]:bg-surface-3"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48">
              <DropdownMenuItem @select="router.push(at('team-issues', team.key))">
                <Layers aria-hidden="true" />
                Issues
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="team.cyclesEnabled"
                @select="router.push(at('cycles', team.key))"
              >
                <IterationCcw aria-hidden="true" />
                Cycles
              </DropdownMenuItem>
              <DropdownMenuItem @select="router.push(at('team-projects', team.key))">
                <FolderKanban aria-hidden="true" />
                Projects
              </DropdownMenuItem>
              <DropdownMenuItem @select="router.push(at('team-views', team.key))">
                <SquareStack aria-hidden="true" />
                Views
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="router.push(at('team-settings', team.key))">
                <Settings aria-hidden="true" />
                Team settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </SettingsSection>

    <SettingsSection
      id="new-team"
      title="New team"
      description="The identifier prefixes the team's issue IDs, like TIP-12."
    >
      <div class="rounded-lg border border-hairline bg-surface-1 p-4">
        <CreateTeamForm />
      </div>
    </SettingsSection>
  </div>
</template>
