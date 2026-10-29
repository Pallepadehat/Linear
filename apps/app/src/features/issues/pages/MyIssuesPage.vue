<script setup lang="ts">
import { CircleUser } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <EmptyState
    :icon="CircleUser"
    title="No issues assigned to you"
    description="Issues assigned to you will show up here."
  />
</template>
