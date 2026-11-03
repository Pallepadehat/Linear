import { useQuery } from '@tanstack/vue-query'
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'

/**
 * The team from the optional `:teamKey` param, looked up in the (sidebar-cached) team list, and
 * the panel breadcrumb `Team › <page>` while it is shown. Without the param the page is
 * workspace-wide and `team` stays undefined.
 */
export function useRouteTeam(page: string) {
  const route = useRoute()
  const ui = useUiStore()
  const { slug } = useCurrentWorkspace()
  const teamKey = computed(() =>
    typeof route.params.teamKey === 'string' ? route.params.teamKey : undefined,
  )
  const { data: teams, isPending } = useQuery(
    computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
  )
  const team = computed(() =>
    teamKey.value ? teams.value?.find((t) => t.key === teamKey.value) : undefined,
  )
  const notFound = computed(() => Boolean(teamKey.value) && !isPending.value && !team.value)

  watchEffect(() => {
    if (team.value) ui.breadcrumb = [team.value.name, page]
  })

  return { teamKey, team, notFound }
}
