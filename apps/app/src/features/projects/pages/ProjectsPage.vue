<script setup lang="ts">
import { FolderKanban } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <EmptyState
    :icon="FolderKanban"
    title="No projects yet"
    description="Projects group related issues across teams."
  />
</template>
