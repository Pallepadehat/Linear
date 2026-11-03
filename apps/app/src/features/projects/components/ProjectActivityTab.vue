<script setup lang="ts">
import { Activity } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'

// The full project activity feed (M9-06 `ProjectActivityFeed`) renders here.
defineProps<{ workspaceSlug: string; projectId: string }>()
</script>

<template>
  <EmptyState
    :icon="Activity"
    title="No activity yet"
    description="Changes to the project and its issues show up here."
  />
</template>
