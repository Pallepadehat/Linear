<script setup lang="ts">
import { Layers } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useRouteTeam } from '@/features/teams/composables/useRouteTeam'

// Serves both the workspace and the team views route.
const { notFound } = useRouteTeam('Views')
</script>

<template>
  <EmptyState v-if="notFound" title="Team not found" />
  <!-- Placeholder until custom views land (M10-05). -->
  <EmptyState
    v-else
    :icon="Layers"
    title="No views yet"
    description="Saved filters and display options will show up here."
  />
</template>
