import {
  Bell,
  Box,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  CalendarX2,
  CircleDashed,
  CircleUser,
  GitPullRequest,
  GitPullRequestClosed,
  IterationCcw,
  Link2,
  Signal,
  Tag,
  TextSearch,
  Unlink,
  UserPen,
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
  DATE_PERIOD_LABELS,
  DATE_PERIODS,
  ME,
  describeDateFilter,
  nextOperator,
  operatorLabel,
  toggleValues,
  valuesSummary,
  withOperator,
  type DateDimension,
  type DateFilter,
  type EstimateFilterValue,
  type FilterOperator,
  type IssueFilters,
  type OperatorDimension,
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
    | 'creator'
    | 'project'
    | 'cycle'
    | 'label'
    | 'estimate'
    | 'due'
    | 'subscriber'
    | DateDimension
    | 'content'
    | 'links'
  label: string
  icon: Component
  /** Listed under the filter menu's "Dates" submenu. */
  group?: 'dates'
  /** Values to pick in the menu (date presets for date dimensions; none for text). */
  options: FilterOption[]
  /** Labels of the selected options, in option order. */
  selectedLabels: string[]
  /** Whether the dimension filters at all (it then has a chip). */
  active: boolean
  /** Chip operator text: "is", "is any of", "is not", "include all of", "after", "contains"… */
  operator: string
  /** Flips the chip operator (operator dimensions only). */
  cycleOperator?: () => void
  /** Chip value text: one name, or a count ("3 labels"). */
  summary: string
  /** One value at a time: picking an option replaces it and closes the menu. */
  single?: boolean
  /** Date dimensions: "past …" presets are `options`; before/after use a calendar. */
  date?: { value: DateFilter | null; set: (value: DateFilter | null) => void }
  /** Free text (content). */
  text?: { value: string; set: (value: string) => void }
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
    plural: string,
  ): FilterDimension {
    const built = options.map((option) => ({
      key: option.key,
      label: option.label,
      icon: option.icon,
      selected: option.values.length > 0 && option.values.every((v) => current.includes(v)),
      toggle: () => set(toggleValues(current, option.values)),
    }))
    const selectedLabels = built.filter((o) => o.selected).map((o) => o.label)
    return {
      key,
      label,
      icon,
      options: built,
      selectedLabels,
      active: current.length > 0,
      operator: operatorLabel('is', current.length),
      summary: valuesSummary(selectedLabels, plural),
      clear: () => set([]),
    }
  }

  /** The chip operator flips between is / is not (labels: any of / all of / not). */
  function withOperatorToggle(
    built: FilterDimension,
    key: OperatorDimension,
    f: IssueFilters,
  ): FilterDimension {
    const current: FilterOperator = f.operators[key] ?? 'is'
    return {
      ...built,
      operator: operatorLabel(current, built.selectedLabels.length),
      cycleOperator: () => update(withOperator(f, key, nextOperator(current, key))),
    }
  }

  function dateDimension(
    key: DateDimension,
    label: string,
    icon: Component,
    value: DateFilter | null,
  ): FilterDimension {
    const set = (next: DateFilter | null) => update({ [key]: next })
    const described = value ? describeDateFilter(value) : null
    return {
      key,
      label,
      icon,
      group: 'dates',
      options: DATE_PERIODS.map((period) => ({
        key: period,
        label: DATE_PERIOD_LABELS[period],
        icon: CalendarRange,
        selected: value?.kind === 'past' && value.period === period,
        toggle: () => set({ kind: 'past', period }),
      })),
      selectedLabels: described ? [described.value] : [],
      active: value !== null,
      operator: described?.operator ?? '',
      summary: described?.value ?? '',
      single: true,
      date: { value, set },
      clear: () => set(null),
    }
  }

  /**
   * Links: any link (web link or linked PR, `hasLinks`) and linked pull requests
   * (`hasPullRequests`). Each is has / has none; picking the other side replaces it.
   */
  function linksDimension(f: IssueFilters): FilterDimension {
    const options = (
      [
        { key: 'has', label: 'Has links', icon: Link2, field: 'hasLinks', value: true },
        { key: 'none', label: 'No links', icon: Unlink, field: 'hasLinks', value: false },
        {
          key: 'pr',
          label: 'Has pull requests',
          icon: GitPullRequest,
          field: 'hasPullRequests',
          value: true,
        },
        {
          key: 'no-pr',
          label: 'No pull requests',
          icon: GitPullRequestClosed,
          field: 'hasPullRequests',
          value: false,
        },
      ] as const
    ).map((option) => {
      const selected = f[option.field] === option.value
      return {
        key: option.key,
        label: option.label,
        icon: option.icon,
        selected,
        toggle: () => update({ [option.field]: selected ? null : option.value }),
      }
    })
    const selected = options.filter((o) => o.selected).map((o) => o.label)
    return {
      key: 'links',
      label: 'Links',
      icon: Link2,
      options,
      selectedLabels: selected,
      active: selected.length > 0,
      operator: 'is',
      summary: selected.join(', '),
      single: true,
      clear: () => update({ hasLinks: null, hasPullRequests: null }),
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

    const creatorOptions = subscriberOptions

    const op = withOperatorToggle
    return [
      op(
        dimension(
          'status',
          'Status',
          CircleDashed,
          f.statusIds,
          (v) => update({ statusIds: v }),
          statusOptions,
          'statuses',
        ),
        'status',
        f,
      ),
      op(
        dimension(
          'assignee',
          'Assignee',
          CircleUser,
          f.assigneeIds,
          (v) => update({ assigneeIds: v }),
          assigneeOptions,
          'assignees',
        ),
        'assignee',
        f,
      ),
      op(
        dimension(
          'creator',
          'Creator',
          UserPen,
          f.creatorIds,
          (v) => update({ creatorIds: v }),
          creatorOptions,
          'creators',
        ),
        'creator',
        f,
      ),
      op(
        dimension(
          'priority',
          'Priority',
          Signal,
          f.priorities,
          (v) => update({ priorities: v }),
          priorityOptions,
          'priorities',
        ),
        'priority',
        f,
      ),
      op(
        dimension(
          'label',
          'Labels',
          Tag,
          f.labelIds,
          (v) => update({ labelIds: v }),
          labelOptions,
          'labels',
        ),
        'label',
        f,
      ),
      dateDimension('created', 'Created', CalendarPlus, f.created),
      dateDimension('updated', 'Updated', CalendarClock, f.updated),
      dateDimension('completed', 'Completed', CalendarCheck2, f.completed),
      // A project page is already scoped to one project.
      ...(projectId
        ? []
        : [
            op(
              dimension(
                'project',
                'Project',
                Box,
                f.projectIds,
                (v) => update({ projectIds: v }),
                projectOptions,
                'projects',
              ),
              'project',
              f,
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
              'cycles',
            ),
          ]
        : []),
      ...(estimateTeams.length || f.estimates.length
        ? [
            dimension(
              'estimate',
              'Estimate',
              EstimateIcon,
              f.estimates,
              (v) => update({ estimates: v }),
              estimateOptions,
              'estimates',
            ),
          ]
        : []),
      dimension(
        'due',
        'Due date',
        CalendarDays,
        f.due,
        (v) => update({ due: v }),
        dueOptions,
        'due dates',
      ),
      dimension(
        'subscriber',
        'Subscribers',
        Bell,
        f.subscriberIds,
        (v) => update({ subscriberIds: v }),
        subscriberOptions,
        'subscribers',
      ),
      {
        key: 'content',
        label: 'Content',
        icon: TextSearch,
        options: [],
        selectedLabels: f.content ? [f.content] : [],
        active: f.content !== '',
        operator: 'contains',
        summary: f.content ? `“${f.content}”` : '',
        text: { value: f.content, set: (content) => update({ content: content.trim() }) },
        clear: () => update({ content: '' }),
      },
      linksDimension(f),
    ]
  })
}
