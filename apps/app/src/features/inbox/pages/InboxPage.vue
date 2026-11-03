<script setup lang="ts">
import { Inbox } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <!-- Placeholder until notifications land (M10-02). -->
  <EmptyState
    :icon="Inbox"
    title="No notifications"
    description="Updates on issues you follow will show up here."
  />
</template>
