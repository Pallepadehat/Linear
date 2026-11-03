<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Settings } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { orpc } from '@/lib/orpc'
import CreateTeamForm from '../components/CreateTeamForm.vue'

const { slug } = useCurrentWorkspace()
const { data: teams, isPending } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
</script>

<template>
  <div class="mx-auto grid w-full max-w-3xl gap-8 px-6 py-8">
    <section aria-labelledby="teams-heading" class="grid gap-3">
      <h2 id="teams-heading" class="text-xs font-medium tracking-wide text-ink-subtle uppercase">
        Teams
      </h2>
      <ul class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1">
        <li v-if="isPending" class="px-4 py-3 text-ink-subtle">Loading…</li>
        <li v-for="team in teams" :key="team.id" class="flex items-center hover:bg-surface-2">
          <RouterLink
            :to="{ name: 'team-issues', params: { workspaceSlug: slug, teamKey: team.key } }"
            class="flex min-w-0 flex-1 items-center justify-between gap-4 py-3 pl-4"
          >
            <span class="truncate font-medium text-ink">{{ team.name }}</span>
            <span class="font-mono text-xs text-ink-subtle">{{ team.key }}</span>
          </RouterLink>
          <Button as-child variant="ghost" size="icon-sm" class="mx-2">
            <RouterLink
              :to="{ name: 'team-settings', params: { workspaceSlug: slug, teamKey: team.key } }"
              :aria-label="`${team.name} settings`"
              :title="`${team.name} settings`"
            >
              <Settings aria-hidden="true" />
            </RouterLink>
          </Button>
        </li>
      </ul>
    </section>
    <section aria-labelledby="new-team-heading" class="grid gap-3">
      <h2 id="new-team-heading" class="text-xs font-medium tracking-wide text-ink-subtle uppercase">
        New team
      </h2>
      <div class="rounded-lg border border-hairline bg-surface-1 p-4">
        <CreateTeamForm />
      </div>
    </section>
  </div>
</template>
