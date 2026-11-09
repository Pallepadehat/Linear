import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { cycleListOptions } from '@/features/cycles/queries'
import { projectListOptions } from '@/features/projects/queries'
import type { EstimateSettings } from '@/lib/estimates'
import { orpc } from '@/lib/orpc'
import { issueListOptions, useUpdateIssue, type IssueListFilter } from '../queries'
import { useIssueFilters } from './useIssueFilters'

/**
 * What the list and board views both need: the issue pages, the people and
 * labels the pickers offer, each listed team's statuses and cycles and the optimistic
 * update mutation. Issues follow the filters in the route query and the view's
 * display options (passed in through `filter`).
 */
export function useIssueViewData(
  workspaceSlug: MaybeRefOrGetter<string>,
  filter: MaybeRefOrGetter<IssueListFilter>,
) {
  const slug = computed(() => toValue(workspaceSlug))
  const { filters } = useIssueFilters()
  const listOptions = computed(() => issueListOptions(slug.value, toValue(filter), filters.value))
  const query = useInfiniteQuery(listOptions)
  const { data: members } = useQuery(
    computed(() =>
      orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
    ),
  )
  const { data: labels } = useQuery(
    computed(() => orpc.labels.list.queryOptions({ input: { workspaceSlug: slug.value } })),
  )
  // Project names and icons for grouping by project.
  const { data: projects } = useQuery(computed(() => projectListOptions(slug.value)))
  const { data: teams } = useQuery(
    computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
  )

  const users = computed(
    () =>
      members.value?.map((m) => ({
        id: m.userId,
        name: m.name,
        email: m.email,
        avatarUrl: m.avatarUrl,
      })) ?? [],
  )
  const issues = computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? [])

  // The status picker offers the issue's own team's statuses, so load them for
  // every team with an issue on screen (a handful; one `teams.get` each) plus
  // the filtered team, whose empty statuses the board still shows as columns.
  const listedTeams = computed(() => {
    const ids = new Set(issues.value.map((issue) => issue.teamId))
    const teamId = toValue(filter).teamId
    if (teamId) ids.add(teamId)
    return teams.value?.filter((team) => ids.has(team.id)) ?? []
  })
  const teamQueries = useQueries({
    queries: computed(() =>
      listedTeams.value.map((team) =>
        orpc.teams.get.queryOptions({ input: { workspaceSlug: slug.value, key: team.key } }),
      ),
    ),
  })
  const statusesByTeam = computed(
    () => new Map(teamQueries.value.flatMap((q) => (q.data ? [[q.data.id, q.data.statuses]] : []))),
  )

  // Cycle pickers on rows offer the issue's own team's cycles (teams with cycles on).
  const cycleQueries = useQueries({
    queries: computed(() =>
      listedTeams.value
        .filter((team) => team.cyclesEnabled)
        .map((team) => cycleListOptions(slug.value, team.id)),
    ),
  })
  const cyclesByTeam = computed(() => {
    const map = new Map<string, NonNullable<(typeof cycleQueries.value)[number]['data']>>()
    for (const q of cycleQueries.value) {
      const teamId = q.data?.[0]?.teamId
      if (q.data && teamId) map.set(teamId, q.data)
    }
    return map
  })
  // Every team's estimate scale, for the estimate chips and the group sums.
  const estimatesByTeam = computed(
    () =>
      new Map<string, EstimateSettings>(
        (teams.value ?? []).map((team) => [
          team.id,
          { scale: team.estimateScale, allowZero: team.estimateAllowZero },
        ]),
      ),
  )

  const updateIssue = useUpdateIssue(slug)

  return {
    query,
    /** The list query's key, for the detail page's prev/next context. */
    queryKey: computed(() => listOptions.value.queryKey),
    issues,
    users,
    labels: computed(() => labels.value ?? []),
    projects: computed(() => projects.value ?? []),
    statusesByTeam,
    cyclesByTeam,
    estimatesByTeam,
    updateIssue,
  }
}
