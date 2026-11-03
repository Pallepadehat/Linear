<script setup lang="ts">
import type { Project, ProjectLabel, Team, Member } from '@linear/contract'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MilestoneIcon from '@/components/common/MilestoneIcon.vue'
import PriorityPicker from '@/components/common/PriorityPicker.vue'
import { useIssueFilters } from '@/features/issues/composables/useIssueFilters'
import { serializeIssueFilters } from '@/features/issues/issue-filters'
import { toPriority, type Priority } from '@/lib/priorities'
import { milestoneListOptions, milestonePercent } from '../milestones'
import { projectTabQuery } from '../project-tabs'
import type { ProjectChanges } from '../queries'
import PanelCard from './PanelCard.vue'
import ProjectDatePicker from './ProjectDatePicker.vue'
import ProjectLabelsPicker from './ProjectLabelsPicker.vue'
import ProjectLeadPicker from './ProjectLeadPicker.vue'
import ProjectMembersPicker from './ProjectMembersPicker.vue'
import ProjectProgress from './ProjectProgress.vue'
import ProjectStatusPicker from './ProjectStatusPicker.vue'
import ProjectTeamsPicker from './ProjectTeamsPicker.vue'

// The project page's right panel: Properties, Milestones, Progress (slot for the M9-05 chart)
// and Activity (slot for the M9-06 card). Open/closed lives in the preferences store.
const props = defineProps<{
  workspaceSlug: string
  project: Project
  members: Member[]
  teams: Team[]
  labels: ProjectLabel[]
}>()
const emit = defineEmits<{ save: [changes: ProjectChanges] }>()
defineSlots<{
  /** Replaces the default progress bar (M9-05 progress chart). */
  progress?: () => unknown
  /** The latest activity (M9-06 `ProjectActivityCard`). */
  activity?: () => unknown
}>()

const status = computed({
  get: () => props.project.status,
  set: (value) => emit('save', { status: value }),
})
const priority = computed({
  get: () => toPriority(props.project.priority),
  set: (value: Priority) => emit('save', { priority: value }),
})
const leadId = computed({
  get: () => props.project.leadId,
  set: (id: string | null) => emit('save', { leadId: id }),
})
const memberIds = computed({
  get: () => props.project.memberIds,
  set: (ids: string[]) => emit('save', { memberIds: ids }),
})
const startDate = computed({
  get: () => props.project.startDate,
  set: (day: string | null) => emit('save', { startDate: day }),
})
const targetDate = computed({
  get: () => props.project.targetDate,
  set: (day: string | null) => emit('save', { targetDate: day }),
})
const teamIds = computed({
  get: () => props.project.teamIds,
  set: (ids: string[]) => emit('save', { teamIds: ids }),
})
const labelIds = computed({
  get: () => props.project.labelIds,
  set: (ids: string[]) => emit('save', { labelIds: ids }),
})

const { data: milestones } = useQuery(
  computed(() => milestoneListOptions(props.workspaceSlug, props.project.id)),
)

// A milestone filters the Issues tab (`?tab=issues&milestone=<id>`); clicking the active
// one again, or "Clear filter", removes it. Pushes, so Back returns to the previous view.
const route = useRoute()
const router = useRouter()
const { filters, update } = useIssueFilters()
const activeMilestones = computed(() => new Set(filters.value.milestoneIds))
function filterByMilestone(id: string) {
  const milestoneIds = activeMilestones.value.has(id) && activeMilestones.value.size === 1 ? [] : [id]
  const { milestone: _milestone, ...rest } = projectTabQuery(route.query, 'issues')
  void router.push({
    query: { ...rest, ...serializeIssueFilters({ ...filters.value, milestoneIds }) },
  })
}

const rowClass = 'flex min-h-8 items-center gap-2 px-2 text-[13px]'
const labelClass = 'w-24 shrink-0 text-ink-subtle'
</script>

<template>
  <aside
    id="project-panel"
    aria-label="Project details"
    class="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-hairline bg-panel p-3"
  >
    <PanelCard title="Properties">
      <div class="grid">
        <div :class="rowClass">
          <span :class="labelClass">Status</span>
          <ProjectStatusPicker v-model="status" />
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Priority</span>
          <PriorityPicker v-model="priority" no-hotkey />
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Lead</span>
          <ProjectLeadPicker v-model="leadId" :members="members" />
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Members</span>
          <ProjectMembersPicker v-model="memberIds" :members="members" />
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Start date</span>
          <ProjectDatePicker v-model="startDate" label="Start date" />
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Target date</span>
          <ProjectDatePicker v-model="targetDate" label="Target date" />
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Teams</span>
          <ProjectTeamsPicker v-model="teamIds" :teams="teams" />
        </div>
        <div :class="rowClass">
          <span :class="labelClass">Labels</span>
          <ProjectLabelsPicker v-model="labelIds" :labels="labels" :workspace-slug="workspaceSlug" />
        </div>
      </div>
    </PanelCard>

    <PanelCard title="Milestones">
      <template v-if="activeMilestones.size" #actions>
        <button
          type="button"
          class="rounded-md px-1 text-xs text-ink-subtle outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          @click="update({ milestoneIds: [] })"
        >
          Clear filter
        </button>
      </template>
      <ul v-if="milestones?.length" class="grid">
        <li v-for="milestone in milestones" :key="milestone.id">
          <button
            type="button"
            class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-hidden hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
            :class="activeMilestones.has(milestone.id) ? 'bg-surface-2 text-ink' : 'text-ink-muted'"
            :aria-pressed="activeMilestones.has(milestone.id)"
            :title="`Show ${milestone.name} issues`"
            @click="filterByMilestone(milestone.id)"
          >
            <MilestoneIcon :progress="milestone.progress" />
            <span class="min-w-0 flex-1 truncate">{{ milestone.name }}</span>
            <span class="shrink-0 text-xs text-ink-subtle tabular-nums">
              {{ milestonePercent(milestone) }}%
              <span class="sr-only">complete</span>
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="px-2 text-[13px] text-ink-tertiary">No milestones yet.</p>
    </PanelCard>

    <PanelCard title="Progress">
      <slot name="progress">
        <ProjectProgress class="px-2 py-1" :progress="project.progress" />
      </slot>
    </PanelCard>

    <PanelCard title="Activity">
      <slot name="activity">
        <p class="px-2 text-[13px] text-ink-tertiary">Project activity shows up here.</p>
      </slot>
    </PanelCard>
  </aside>
</template>
