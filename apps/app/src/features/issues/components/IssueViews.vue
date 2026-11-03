<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { usePreferencesStore } from '@/stores/preferences'
import { PANEL_HEADER_ACTIONS } from '@/layouts/panel-header'
import IssueLayoutToggle from './IssueLayoutToggle.vue'
import IssueList from './IssueList.vue'

// Drag and drop is only needed once someone opens the board.
const IssueBoard = defineAsyncComponent(() => import('./IssueBoard.vue'))

defineProps<{ workspaceSlug: string; teamId?: string }>()

const preferences = usePreferencesStore()
</script>

<template>
  <Teleport defer :to="PANEL_HEADER_ACTIONS">
    <IssueLayoutToggle />
  </Teleport>
  <IssueBoard
    v-if="preferences.issueLayout === 'board'"
    :workspace-slug="workspaceSlug"
    :team-id="teamId"
  />
  <IssueList v-else :workspace-slug="workspaceSlug" :team-id="teamId" />
</template>
