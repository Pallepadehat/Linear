<script setup lang="ts">
import ProjectActivityFeed from './ProjectActivityFeed.vue'

// `?tab=activity`: the full project feed (M9-06), newest first with infinite scroll.
defineProps<{ workspaceSlug: string; projectId: string }>()
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl px-8 py-6">
      <h2 class="sr-only">Activity</h2>
      <ProjectActivityFeed
        :key="projectId"
        :workspace-slug="workspaceSlug"
        :project-id="projectId"
      />
    </div>
  </div>
</template>
