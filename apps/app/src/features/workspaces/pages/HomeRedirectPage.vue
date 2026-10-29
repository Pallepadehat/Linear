<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { orpc } from '@/lib/orpc'
import { usePreferencesStore } from '@/stores/preferences'

// "/" sends the user to their last workspace, any workspace, or setup.
const router = useRouter()
const preferences = usePreferencesStore()
const { data, isError } = useQuery(orpc.me.listWorkspaces.queryOptions())

watchEffect(() => {
  if (!data.value) return
  const target = data.value.find((w) => w.slug === preferences.lastWorkspaceSlug) ?? data.value[0]
  void router.replace(
    target
      ? { name: 'my-issues', params: { workspaceSlug: target.slug } }
      : { name: 'workspace-setup' },
  )
})
</script>

<template>
  <main class="flex min-h-svh items-center justify-center bg-canvas text-ink-subtle">
    <p v-if="isError" role="alert">Could not load your workspaces. Refresh to try again.</p>
    <p v-else class="sr-only">Loading…</p>
  </main>
</template>
