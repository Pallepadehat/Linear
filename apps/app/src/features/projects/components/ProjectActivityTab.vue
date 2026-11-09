<script setup lang="ts">
import ProjectActivityFeed from './ProjectActivityFeed.vue'
import ProjectUpdatesFeed from './ProjectUpdatesFeed.vue'

// `?tab=activity`: the project's updates (M9-04), then its full feed (M9-06), each newest
// first with infinite scroll.
defineProps<{ workspaceSlug: string; projectId: string }>()
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto grid w-full max-w-3xl min-w-0 gap-10 px-4 py-6 md:px-8">
      <ProjectUpdatesFeed
        :key="`updates-${projectId}`"
        :workspace-slug="workspaceSlug"
        :project-id="projectId"
      />
      <ProjectActivityFeed
        :key="projectId"
        :workspace-slug="workspaceSlug"
        :project-id="projectId"
      />
    </div>
  </div>
</template>
