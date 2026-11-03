<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useUpdateViewer } from '../composables/useUpdateViewer'
import { projectUpdateRow } from '../project-updates'
import { projectLatestUpdateOptions } from '../queries'
import ProjectUpdateComposer from './ProjectUpdateComposer.vue'
import ProjectUpdateItem from './ProjectUpdateItem.vue'

// The Overview's update slot: "Write first project update" until there is one, then
// the latest update with a "New update" button; either opens the composer in place.
const props = defineProps<{ workspaceSlug: string; projectId: string }>()

const latest = useQuery(
  computed(() => projectLatestUpdateOptions(props.workspaceSlug, props.projectId)),
)
const viewer = useUpdateViewer()
const row = computed(() => {
  const update = latest.data.value?.items[0]
  return update ? projectUpdateRow(update, viewer.value) : null
})
const composing = ref(false)
</script>

<template>
  <ProjectUpdateComposer
    v-if="composing"
    :workspace-slug="workspaceSlug"
    :project-id="projectId"
    @done="composing = false"
  />
  <section v-else-if="row" aria-labelledby="project-latest-update-heading" class="grid gap-2">
    <div class="flex items-center justify-between">
      <h2 id="project-latest-update-heading" class="text-xs font-medium text-ink-subtle">
        Latest update
      </h2>
      <Button variant="ghost" size="sm" @click="composing = true">
        <Plus aria-hidden="true" />
        New update
      </Button>
    </div>
    <ProjectUpdateItem :workspace-slug="workspaceSlug" :project-id="projectId" v-bind="row" />
  </section>
  <button
    v-else-if="latest.isSuccess.value"
    type="button"
    class="grid w-full gap-1 rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-left outline-hidden hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
    @click="composing = true"
  >
    <span class="text-[13px] font-medium text-ink">Write first project update</span>
    <span class="text-[13px] text-ink-subtle">
      Updates share the project's progress and health with the team.
    </span>
  </button>
</template>
