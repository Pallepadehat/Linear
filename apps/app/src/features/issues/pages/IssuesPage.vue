<script setup lang="ts">
import { Layers } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <EmptyState
    :icon="Layers"
    title="No issues yet"
    description="Issues from every team in this workspace will show up here."
  />
</template>
