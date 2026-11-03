<script setup lang="ts">
import IssueList from '@/features/issues/components/IssueList.vue'

defineProps<{ workspaceSlug: string; projectId: string }>()
</script>

<template>
  <!-- Filters (e.g. a milestone from the right panel) live in the route query. -->
  <IssueList
    :key="projectId"
    :workspace-slug="workspaceSlug"
    :project-id="projectId"
    filter-counts
  />
</template>
