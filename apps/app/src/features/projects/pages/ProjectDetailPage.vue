<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { storeToRefs } from 'pinia'
import { X } from '@lucide/vue'
import { DialogClose, DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import IconButton from '@/components/common/IconButton.vue'
import SheetOverlay from '@/components/ui/sheet/SheetOverlay.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { usePreferencesStore } from '@/stores/preferences'
import ProjectActivityCard from '../components/ProjectActivityCard.vue'
import ProjectDetailHeader from '../components/ProjectDetailHeader.vue'
import ProjectSidePanel from '../components/ProjectSidePanel.vue'
import ProjectTabs from '../components/ProjectTabs.vue'
import { parseProjectTab, projectTabQuery, type ProjectTab } from '../project-tabs'
import {
  projectLabelListOptions,
  projectOptions,
  useUpdateProject,
  type ProjectChanges,
} from '../queries'

// Each tab loads on first visit.
const ProjectOverviewTab = defineAsyncComponent(
  () => import('../components/ProjectOverviewTab.vue'),
)
const ProjectActivityTab = defineAsyncComponent(
  () => import('../components/ProjectActivityTab.vue'),
)
const ProjectIssuesTab = defineAsyncComponent(() => import('../components/ProjectIssuesTab.vue'))
// The chart isn't needed to edit the project, so it loads after the panel.
const ProjectProgressCard = defineAsyncComponent(
  () => import('../components/ProjectProgressCard.vue'),
)

const route = useRoute()
const router = useRouter()
const { slug } = useCurrentWorkspace()
const { projectPanelOpen } = storeToRefs(usePreferencesStore())
const projectId = computed(() => String(route.params.projectId))

const { data: project, error } = useQuery(
  computed(() => projectOptions(slug.value, projectId.value)),
)
const { data: teams } = useQuery(
  computed(() => orpc.teams.list.queryOptions({ input: { workspaceSlug: slug.value } })),
)
const { data: members } = useQuery(
  computed(() =>
    orpc.workspaces.listMembers.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)
const { data: labels } = useQuery(computed(() => projectLabelListOptions(slug.value)))

// Details: the docked right panel on desktop (remembered), a right drawer on phones (closed
// on each visit, since it covers the page).
const isMobile = useIsMobile()
const mobileDetailsOpen = ref(false)
const detailsOpen = computed(() =>
  isMobile.value ? mobileDetailsOpen.value : projectPanelOpen.value,
)
function toggleDetails() {
  if (isMobile.value) mobileDetailsOpen.value = !mobileDetailsOpen.value
  else projectPanelOpen.value = !projectPanelOpen.value
}
watch(isMobile, () => (mobileDetailsOpen.value = false))

// `?tab=` deep-links; switching pushes a history entry so Back walks the tabs.
const tab = computed<ProjectTab>({
  get: () => parseProjectTab(route.query),
  set: (value) => void router.push({ query: projectTabQuery(route.query, value) }),
})

// Edits apply to the cache immediately and roll back if the save fails.
const update = useUpdateProject(slug)
function save(changes: ProjectChanges) {
  if (project.value) update.mutate({ project: project.value, changes })
}
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="Project not found" />
  <EmptyState
    v-else-if="error"
    title="Couldn't load project"
    description="Check your connection and try again."
  />
  <div v-else-if="project" class="flex min-h-0 flex-1">
    <ProjectDetailHeader
      :workspace-slug="slug"
      :project="project"
      :details-open="detailsOpen"
      @toggle-details="toggleDetails"
    />
    <div class="flex min-w-0 flex-1 flex-col">
      <div
        class="flex h-11 shrink-0 items-center overflow-x-auto border-b border-hairline px-2 md:px-4"
      >
        <ProjectTabs v-model="tab" panel-id="project-tabpanel" />
      </div>
      <div
        id="project-tabpanel"
        role="tabpanel"
        :aria-labelledby="`project-tab-${tab}`"
        class="flex min-h-0 flex-1 flex-col"
      >
        <ProjectOverviewTab
          v-if="tab === 'overview'"
          :workspace-slug="slug"
          :project="project"
          :members="members ?? []"
          :teams="teams ?? []"
          :labels="labels ?? []"
          @save="save"
        />
        <ProjectActivityTab
          v-else-if="tab === 'activity'"
          :workspace-slug="slug"
          :project-id="project.id"
        />
        <ProjectIssuesTab v-else :workspace-slug="slug" :project-id="project.id" />
      </div>
    </div>
    <ProjectSidePanel
      v-if="!isMobile && projectPanelOpen"
      class="w-80 border-l border-hairline"
      :workspace-slug="slug"
      :project="project"
      :members="members ?? []"
      :teams="teams ?? []"
      :labels="labels ?? []"
      @save="save"
    >
      <template #progress>
        <ProjectProgressCard bare :workspace-slug="slug" :project-id="project.id" />
      </template>
      <template #activity>
        <ProjectActivityCard :workspace-slug="slug" :project-id="project.id" />
      </template>
    </ProjectSidePanel>
    <DialogRoot v-if="isMobile" v-model:open="mobileDetailsOpen">
      <DialogPortal>
        <SheetOverlay />
        <DialogContent
          class="fixed inset-y-0 right-0 z-50 flex w-[22rem] max-w-[92vw] flex-col border-l border-hairline bg-panel outline-hidden data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
          :aria-describedby="undefined"
        >
          <div class="flex h-11 shrink-0 items-center border-b border-hairline pr-2 pl-4">
            <DialogTitle class="font-medium text-ink">Project details</DialogTitle>
            <DialogClose as-child>
              <IconButton :icon="X" label="Close details" class="ml-auto" />
            </DialogClose>
          </div>
          <ProjectSidePanel
            class="min-h-0 w-full flex-1"
            :workspace-slug="slug"
            :project="project"
            :members="members ?? []"
            :teams="teams ?? []"
            :labels="labels ?? []"
            @save="save"
          >
            <template #progress>
              <ProjectProgressCard bare :workspace-slug="slug" :project-id="project.id" />
            </template>
            <template #activity>
              <ProjectActivityCard :workspace-slug="slug" :project-id="project.id" />
            </template>
          </ProjectSidePanel>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
