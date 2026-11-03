import {
  Bell,
  Box,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CalendarX2,
  CircleDashed,
  CircleUser,
  IterationCcw,
  Signal,
  Tag,
} from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, h, type Component, type MaybeRefOrGetter, toValue } from 'vue'
import CycleIcon from '@/components/common/CycleIcon.vue'
import EstimateIcon from '@/components/common/EstimateIcon.vue'
import PriorityIcon from '@/components/common/PriorityIcon.vue'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UnassignedIcon from '@/components/common/UnassignedIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { cycleName, cyclePercent } from '@/features/cycles/cycles'
import { cycleListOptions } from '@/features/cycles/queries'
import { orpc } from '@/lib/orpc'
import { estimateLabel, estimateValues } from '@/lib/estimates'
import { PRIORITIES } from '@/lib/priorities'
import { CATEGORY_ORDER } from '../group-issues'
import {
  ANY,
  ME,
  toggleValues,
  type EstimateFilterValue,
  type IssueFilters,
} from '../issue-filters'
import type { IssueDueFilter } from '@linear/contract'

export type FilterOption = {
  /** Unique within the dimension; also the menu item's text value. */
  key: string
  label: string
  icon: Component
  selected: boolean
  toggle: () => void
}

export type FilterDimension = {
  key:
    | 'status'
    | 'priority'
    | 'assignee'
    | 'project'
    | 'cycle'
    | 'label'
    | 'estimate'
    | 'due'
    | 'subscriber'
  label: string
  icon: Component
  options: FilterOption[]
  /** Labels of the selected options, in option order. */
  selectedLabels: string[]
  clear: () => void
}

type Scope = { workspaceSlug: string; teamId?: string; projectId?: string; cycleId?: string }

/**
 * The filter menu's dimensions and their options, built from workspace data.
 * Statuses are per team, so the workspace-wide view merges same-named statuses
 * (each team's "Todo") into one option that selects all their ids.
 */
export function useFilterDimensions(
  scope: MaybeRefOrGetter<Scope>,
  filters: MaybeRefOrGetter<IssueFilters>,
  update: (changes: Partial<IssueFilters>) => void,
) {
  const input = computed(() => ({ workspaceSlug: toValue(scope).workspaceSlug }))
  const { data: teams } = useQuery(
    computed(() => orpc.teams.list.queryOptions({ input: input.value })),
  )
  const { data: members } = useQuery(
    computed(() => orpc.workspaces.listMembers.queryOptions({ input: input.value })),
  )
  const { data: projects } = useQuery(
    computed(() => orpc.projects.list.queryOptions({ input: input.value })),
  )
  const { data: labels } = useQuery(
    computed(() => orpc.labels.list.queryOptions({ input: input.value })),
  )
  // Cycles belong to a team, so only a team's views (with cycles on) filter by them.
  const cycleTeam = computed(() => {
    const { teamId, cycleId } = toValue(scope)
    if (!teamId || cycleId) return undefined
    return teams.value?.find((team) => team.id === teamId && team.cyclesEnabled)
  })
  const { data: cycles } = useQuery(
    computed(() => ({
      ...cycleListOptions(input.value.workspaceSlug, cycleTeam.value?.id ?? ''),
      enabled: Boolean(cycleTeam.value),
    })),
  )

  function dimension<T>(
    key: FilterDimension['key'],
    label: string,
    icon: Component,
    current: T[],
    set: (values: T[]) => void,
    options: { key: string; label: string; icon: Component; values: T[] }[],
  ): FilterDimension {
    const built = options.map((option) => ({
      key: option.key,
      label: option.label,
      icon: option.icon,
      selected: option.values.length > 0 && option.values.every((v) => current.includes(v)),
      toggle: () => set(toggleValues(current, option.values)),
    }))
    return {
      key,
      label,
      icon,
      options: built,
      selectedLabels: built.filter((o) => o.selected).map((o) => o.label),
      clear: () => set([]),
    }
  }

  return computed<FilterDimension[]>(() => {
    const { teamId, projectId } = toValue(scope)
    const f = toValue(filters)

    const statuses = new Map<
      string,
      { label: string; category: keyof typeof CATEGORY_ORDER; position: number; ids: string[] }
    >()
    for (const team of teams.value ?? []) {
      if (teamId && team.id !== teamId) continue
      for (const status of team.statuses) {
        const key = `${status.category}:${status.name}`
        const entry = statuses.get(key)
        if (entry) entry.ids.push(status.id)
        else
          statuses.set(key, {
            label: status.name,
            category: status.category,
            position: status.position,
            ids: [status.id],
          })
      }
    }
    const statusOptions = [...statuses.entries()]
      .sort(
        ([, a], [, b]) =>
          CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || a.position - b.position,
      )
      .map(([key, s]) => ({
        key,
        label: s.label,
        icon: () => h(StatusIcon, { category: s.category }),
        values: s.ids,
      }))

    // Linear's order: Urgent first, No priority last.
    const priorityOptions = [...PRIORITIES.slice(1), PRIORITIES[0]].map((p) => ({
      key: String(p.value),
      label: p.label,
      icon: () => h(PriorityIcon, { priority: p.value }),
      values: [p.value as number],
    }))

    const assigneeOptions = [
      { key: 'none', label: 'No assignee', icon: () => h(UnassignedIcon), values: [null] },
      ...(members.value ?? []).map((m) => ({
        key: m.userId,
        label: m.name,
        icon: () => h(UserAvatar, { name: m.name, src: m.avatarUrl, size: 'xs' }),
        values: [m.userId as string | null],
      })),
    ]

    const projectOptions = [
      { key: 'none', label: 'No project', icon: () => h(ProjectIcon), values: [null] },
      ...(projects.value ?? []).map((p) => ({
        key: p.id,
        label: p.name,
        icon: () => h(ProjectIcon, { src: p.iconUrl }),
        values: [p.id as string | null],
      })),
    ]

    const cycleOptions = [
      { key: 'none', label: 'No cycle', icon: () => h(CycleIcon), values: [null] },
      ...(cycles.value ?? []).map((c) => ({
        key: c.id,
        label: cycleName(c),
        icon: () => h(CycleIcon, { progress: cyclePercent(c.progress) / 100 }),
        values: [c.id as string | null],
      })),
    ]

    const labelOptions = (labels.value ?? []).map((l) => ({
      key: l.id,
      label: l.name,
      // The label's own color is user data, not a design token.
      icon: () =>
        h('span', {
          class: 'size-2 shrink-0 rounded-full',
          style: { backgroundColor: l.color },
          'aria-hidden': 'true',
        }),
      values: [l.id],
    }))

    // Only teams that use estimates; values are the union of their scales.
    const estimateTeams = (teams.value ?? []).filter(
      (team) => (!teamId || team.id === teamId) && team.estimateScale !== 'off',
    )
    const scales = new Set(estimateTeams.map((team) => team.estimateScale))
    const [onlyScale] = scales.size === 1 ? [...scales] : []
    const points = [
      ...new Set(
        estimateTeams.flatMap((team) =>
          estimateValues({ scale: team.estimateScale, allowZero: team.estimateAllowZero }),
        ),
      ),
    ].sort((a, b) => a - b)
    const estimateIcon = () => h(EstimateIcon)
    const estimateOptions = [
      { key: ANY, label: 'Has estimate', icon: estimateIcon, values: [ANY as EstimateFilterValue] },
      { key: 'none', label: 'No estimate', icon: estimateIcon, values: [null] },
      ...points.map((value) => ({
        key: String(value),
        label: estimateLabel(value, onlyScale ?? 'linear'),
        icon: estimateIcon,
        values: [value as EstimateFilterValue],
      })),
    ]

    const dueOptions: { key: string; label: string; icon: Component; values: IssueDueFilter[] }[] =
      [
        { key: 'overdue', label: 'Overdue', icon: CalendarClock, values: ['overdue'] },
        {
          key: 'dueThisWeek',
          label: 'Due this week',
          icon: CalendarRange,
          values: ['dueThisWeek'],
        },
        { key: 'noDueDate', label: 'No due date', icon: CalendarX2, values: ['noDueDate'] },
      ]
    // "Me" first; it stays the viewer when the URL is shared.
    const subscriberOptions = [
      { key: ME, label: 'Me', icon: () => h(CircleUser), values: [ME] },
      ...(members.value ?? []).map((m) => ({
        key: m.userId,
        label: m.name,
        icon: () => h(UserAvatar, { name: m.name, src: m.avatarUrl, size: 'xs' }),
        values: [m.userId],
      })),
    ]

    return [
      dimension(
        'status',
        'Status',
        CircleDashed,
        f.statusIds,
        (v) => update({ statusIds: v }),
        statusOptions,
      ),
      dimension(
        'priority',
        'Priority',
        Signal,
        f.priorities,
        (v) => update({ priorities: v }),
        priorityOptions,
      ),
      dimension(
        'assignee',
        'Assignee',
        CircleUser,
        f.assigneeIds,
        (v) => update({ assigneeIds: v }),
        assigneeOptions,
      ),
      // A project page is already scoped to one project.
      ...(projectId
        ? []
        : [
            dimension(
              'project',
              'Project',
              Box,
              f.projectIds,
              (v) => update({ projectIds: v }),
              projectOptions,
            ),
          ]),
      ...(cycleTeam.value
        ? [
            dimension(
              'cycle',
              'Cycle',
              IterationCcw,
              f.cycleIds,
              (v) => update({ cycleIds: v }),
              cycleOptions,
            ),
          ]
        : []),
      dimension('label', 'Labels', Tag, f.labelIds, (v) => update({ labelIds: v }), labelOptions),
      dimension('due', 'Due date', CalendarDays, f.due, (v) => update({ due: v }), dueOptions),
      dimension(
        'subscriber',
        'Subscribers',
        Bell,
        f.subscriberIds,
        (v) => update({ subscriberIds: v }),
        subscriberOptions,
      ),
      ...(estimateTeams.length || f.estimates.length
        ? [
            dimension(
              'estimate',
              'Estimate',
              EstimateIcon,
              f.estimates,
              (v) => update({ estimates: v }),
              estimateOptions,
            ),
          ]
        : []),
    ]
  })
}
