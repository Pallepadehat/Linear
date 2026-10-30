<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import IssueList from '@/features/issues/components/IssueList.vue'
import { errorCode } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const { data: team, error } = useQuery(
  computed(() =>
    orpc.teams.get.queryOptions({
      input: { workspaceSlug: slug.value, key: String(route.params.teamKey) },
    }),
  ),
)

watchEffect(() => {
  if (team.value) ui.breadcrumb = [team.value.name, 'Issues']
})
</script>

<template>
  <EmptyState v-if="errorCode(error) === 'NOT_FOUND'" title="Team not found" />
  <IssueList v-else-if="team" :key="team.id" :workspace-slug="slug" :team-id="team.id" />
</template>
