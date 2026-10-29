<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { orpc } from '@/lib/orpc'
import CreateWorkspaceForm from '../components/CreateWorkspaceForm.vue'

const { data: workspaces } = useQuery(orpc.me.listWorkspaces.queryOptions())
</script>

<template>
  <div class="grid gap-6">
    <div class="space-y-1 text-center">
      <h1 class="text-xl font-semibold tracking-tight text-ink">Create a workspace</h1>
      <p class="text-ink-subtle">Workspaces hold your teams, projects and issues.</p>
    </div>
    <CreateWorkspaceForm />
    <p v-if="workspaces?.length" class="text-center text-ink-subtle">
      <RouterLink to="/" class="font-medium text-primary hover:underline"
        >Back to your workspace</RouterLink
      >
    </p>
  </div>
</template>
