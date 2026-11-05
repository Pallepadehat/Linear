<script setup lang="ts">
import type { UpdateTeamInput } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Plus } from '@lucide/vue'
import { computed, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import AssigneePicker from '@/components/common/AssigneePicker.vue'
import OptionPicker from '@/components/common/OptionPicker.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import StatusPicker from '@/components/common/StatusPicker.vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  WEEKDAYS,
  assignableCycles,
  cycleName,
  cycleRange,
  previewFirstCycle,
} from '@/features/cycles/cycles'
import { cycleListOptions, cyclesKey } from '@/features/cycles/queries'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import LabelsSettings from '@/features/labels/components/LabelsSettings.vue'
import TemplateSettings from '@/features/templates/components/TemplateSettings.vue'
import { errorCode, errorMessage } from '@/lib/errors'
import { client, orpc } from '@/lib/orpc'
import { scalePreview, type EstimateScale } from '@/lib/estimates'
import { toPriority, type Priority } from '@/lib/priorities'
import { useUiStore } from '@/stores/ui'
import SettingsLayout, {
  type SettingsNavItem,
} from '@/features/settings/components/SettingsLayout.vue'
import SettingsSection from '@/features/settings/components/SettingsSection.vue'
import EstimateScalePicker from '../components/EstimateScalePicker.vue'

const route = useRoute()
const ui = useUiStore()
const queryClient = useQueryClient()
const { slug, workspace } = useCurrentWorkspace()
const teamKey = computed(() => String(route.params.teamKey))
const teamOptions = computed(() =>
  orpc.teams.get.queryOptions({ input: { workspaceSlug: slug.value, key: teamKey.value } }),
)
const { data: team, error } = useQuery(teamOptions)
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const assignees = computed(
  () =>
    members.value?.map((m) => ({
      id: m.userId,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl,
    })) ?? [],
)
const isOwner = computed(() => workspace.value?.role === 'owner')

const sections: SettingsNavItem[] = [
  { id: 'issue-defaults', label: 'Issue defaults' },
  { id: 'estimates', label: 'Estimates' },
  { id: 'cycles', label: 'Cycles' },
  { id: 'labels', label: 'Labels' },
  { id: 'templates', label: 'Templates' },
]
const templates = ref<InstanceType<typeof TemplateSettings> | null>(null)

watchEffect(() => {
  if (team.value) ui.breadcrumb = [team.value.name, 'Settings']
})

type Defaults = Omit<UpdateTeamInput, 'workspaceSlug' | 'key'>

// Optimistic: the picker shows the new value at once and rolls back on failure.
const update = useMutation({
  mutationFn: (defaults: Defaults) =>
    client.teams.update({ workspaceSlug: slug.value, key: teamKey.value, ...defaults }),
  onMutate: async (defaults) => {
    const { queryKey } = teamOptions.value
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData(queryKey)
    if (previous) queryClient.setQueryData(queryKey, { ...previous, ...defaults })
    return { previous }
  },
  onError: (error, _defaults, context) => {
    if (context?.previous) queryClient.setQueryData(teamOptions.value.queryKey, context.previous)
    toast.error(errorMessage(error))
  },
  onSuccess: (saved) => queryClient.setQueryData(teamOptions.value.queryKey, saved),
  // The create dialog reads the same query, so it picks up the new defaults; lists
  // and pickers read estimate scales from `teams.list`, and the sidebar shows Cycles
  // only for teams with cycles on.
  onSettled: () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.teams.get.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.teams.list.key() }),
      queryClient.invalidateQueries({ queryKey: cyclesKey() }),
    ]),
})

const defaultStatusId = computed({
  get: () => team.value?.defaultStatusId ?? '',
  set: (id: string) => update.mutate({ defaultStatusId: id }),
})
const defaultPriority = computed({
  get: () => toPriority(team.value?.defaultPriority),
  set: (value: Priority) => update.mutate({ defaultPriority: value }),
})
const estimateScale = computed({
  get: () => team.value?.estimateScale ?? 'off',
  set: (scale: EstimateScale) => update.mutate({ estimateScale: scale }),
})
const estimateAllowZero = computed({
  get: () => team.value?.estimateAllowZero ?? false,
  set: (allowZero: boolean) => update.mutate({ estimateAllowZero: allowZero }),
})
const defaultAssigneeId = computed({
  get: () => team.value?.defaultAssigneeId ?? null,
  set: (id: string | null) => update.mutate({ defaultAssigneeId: id }),
})

type CycleSettingKey =
  'cycleDurationWeeks' | 'cycleStartWeekday' | 'cycleCooldownWeeks' | 'cycleUpcomingCount'
const setting = (key: CycleSettingKey) =>
  computed({
    get: () => team.value?.[key] ?? 0,
    set: (value: number) => update.mutate({ [key]: value }),
  })
const toggle = (key: 'cyclesEnabled' | 'cycleAutoAddStarted' | 'cycleRolloverUnfinished') =>
  computed({
    get: () => team.value?.[key] ?? false,
    set: (value: boolean) => update.mutate({ [key]: value }),
  })
const cyclesEnabled = toggle('cyclesEnabled')
const autoAdd = toggle('cycleAutoAddStarted')
const rollover = toggle('cycleRolloverUnfinished')
const duration = setting('cycleDurationWeeks')
const weekday = setting('cycleStartWeekday')
const cooldown = setting('cycleCooldownWeeks')
const upcomingCount = setting('cycleUpcomingCount')

const weeks = (n: number) => (n === 0 ? 'None' : n === 1 ? '1 week' : `${n} weeks`)
const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: weeks(n) }))
const COOLDOWN_OPTIONS = [0, 1, 2].map((n) => ({ value: n, label: weeks(n) }))
const UPCOMING_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))
const WEEKDAY_OPTIONS = WEEKDAYS.map((label, value) => ({ value, label }))

const { data: cycles } = useQuery(
  computed(() => ({
    ...cycleListOptions(slug.value, team.value?.id ?? ''),
    enabled: Boolean(team.value?.cyclesEnabled),
  })),
)
// The scheduled current/next cycle once cycles are on; before that, what turning them on would create.
const preview = computed(() => {
  if (!team.value) return null
  const next = team.value.cyclesEnabled ? assignableCycles(cycles.value ?? [])[0] : undefined
  if (next) return `${cycleName(next)} · ${cycleRange(next)}`
  return `Cycle 1 · ${cycleRange(previewFirstCycle(team.value))}`
})
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="Team not found" />
  <SettingsLayout v-else-if="team" :title="`${team.name} settings`" :sections="sections">
    <template #subtitle>
      Issue identifiers start with <span class="font-mono text-xs">{{ team.key }}</span
      >.<template v-if="workspace && !isOwner">
        Only workspace owners can change issue defaults, estimates and cycles.</template
      >
    </template>
    <SettingsSection
      id="issue-defaults"
      title="Issue defaults"
      description="Used for new issues in this team when no value is picked."
    >
      <div
        class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1"
        :class="{ 'pointer-events-none opacity-60': !isOwner }"
        :inert="!isOwner || undefined"
      >
        <div class="flex items-center justify-between gap-4 px-4 py-2">
          <span class="min-w-0 text-ink-muted">Status</span>
          <StatusPicker v-model="defaultStatusId" :statuses="team.statuses" no-hotkey />
        </div>
        <div class="flex items-center justify-between gap-4 px-4 py-2">
          <span class="min-w-0 text-ink-muted">Priority</span>
          <PriorityPicker v-model="defaultPriority" no-hotkey />
        </div>
        <div class="flex items-center justify-between gap-4 px-4 py-2">
          <span class="min-w-0 text-ink-muted">Assignee</span>
          <AssigneePicker v-model="defaultAssigneeId" :users="assignees" no-hotkey />
        </div>
      </div>
    </SettingsSection>
    <SettingsSection
      id="estimates"
      title="Estimates"
      description="How issues in this team are sized. Changing the scale keeps existing estimates."
    >
      <div
        class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1"
        :class="{ 'pointer-events-none opacity-60': !isOwner }"
        :inert="!isOwner || undefined"
      >
        <div class="flex items-center justify-between gap-4 px-4 py-2">
          <div class="grid min-w-0">
            <span class="min-w-0 text-ink-muted">Scale</span>
            <span v-if="estimateScale !== 'off'" class="truncate text-xs text-ink-subtle">
              {{ scalePreview({ scale: estimateScale, allowZero: estimateAllowZero }) }}
            </span>
          </div>
          <EstimateScalePicker v-model="estimateScale" :allow-zero="estimateAllowZero" />
        </div>
        <label
          for="estimate-allow-zero"
          class="flex items-center justify-between gap-4 px-4 py-3"
          :class="{ 'opacity-60': estimateScale === 'off' }"
        >
          <span class="min-w-0 text-ink-muted">Allow zero estimates</span>
          <Switch
            id="estimate-allow-zero"
            v-model="estimateAllowZero"
            :disabled="estimateScale === 'off'"
          />
        </label>
      </div>
    </SettingsSection>
    <SettingsSection
      id="cycles"
      title="Cycles"
      description="Time-boxed iterations, scheduled automatically. Dates follow UTC days."
    >
      <div
        class="divide-y divide-hairline rounded-lg border border-hairline bg-surface-1"
        :class="{ 'pointer-events-none opacity-60': !isOwner }"
        :inert="!isOwner || undefined"
      >
        <label class="flex items-center justify-between gap-4 px-4 py-2.5">
          <span class="min-w-0 text-ink-muted">Enable cycles</span>
          <Switch v-model="cyclesEnabled" />
        </label>
        <template v-if="team.cyclesEnabled">
          <div class="flex items-center justify-between gap-4 px-4 py-2">
            <span class="min-w-0 text-ink-muted">Cycle length</span>
            <OptionPicker v-model="duration" label="Cycle length" :options="DURATION_OPTIONS" />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-2">
            <span class="min-w-0 text-ink-muted">Starts on</span>
            <OptionPicker v-model="weekday" label="Start day" :options="WEEKDAY_OPTIONS" />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-2">
            <span class="min-w-0 text-ink-muted">Cooldown between cycles</span>
            <OptionPicker v-model="cooldown" label="Cooldown" :options="COOLDOWN_OPTIONS" />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-2">
            <span class="min-w-0 text-ink-muted">Upcoming cycles</span>
            <OptionPicker
              v-model="upcomingCount"
              label="Upcoming cycles"
              :options="UPCOMING_OPTIONS"
            />
          </div>
          <label class="flex items-center justify-between gap-4 px-4 py-2.5">
            <span class="grid">
              <span class="min-w-0 text-ink-muted">Add started issues to the current cycle</span>
              <span class="text-xs text-ink-subtle">When an issue moves to a started status</span>
            </span>
            <Switch v-model="autoAdd" />
          </label>
          <label class="flex items-center justify-between gap-4 px-4 py-2.5">
            <span class="grid">
              <span class="min-w-0 text-ink-muted">Move unfinished issues to the next cycle</span>
              <span class="text-xs text-ink-subtle">When a cycle ends</span>
            </span>
            <Switch v-model="rollover" />
          </label>
        </template>
        <p
          class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-ink-subtle"
        >
          <span>{{ team.cyclesEnabled ? 'Current or next cycle' : 'First cycle' }}</span>
          <span class="text-ink-muted tabular-nums">{{ preview }}</span>
        </p>
      </div>
    </SettingsSection>
    <SettingsSection
      id="labels"
      title="Labels"
      :description="`Only issues in ${team.name} can use these labels.`"
    >
      <LabelsSettings :team-id="team.id" />
    </SettingsSection>
    <SettingsSection
      id="templates"
      title="Templates"
      description="Team templates are offered alongside workspace templates."
    >
      <template #actions>
        <Button size="sm" @click="templates?.create()">
          <Plus aria-hidden="true" />
          New template
        </Button>
      </template>
      <TemplateSettings ref="templates" :team-id="team.id" />
    </SettingsSection>
  </SettingsLayout>
</template>
