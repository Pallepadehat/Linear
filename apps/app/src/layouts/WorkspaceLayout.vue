<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { usePresence } from '@/features/presence/usePresence'
import { useRealtime } from '@/features/realtime/useRealtime'
import { isPlainShortcut } from '@/lib/keyboard'
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'
import { PANEL_HEADER_ACTIONS } from './panel-header'

const CreateIssueDialog = defineAsyncComponent(
  () => import('@/features/issues/components/CreateIssueDialog.vue'),
)

const route = useRoute()
const ui = useUiStore()

// Teammates' changes show up live while the workspace is open.
const workspaceSlug = () => String(route.params.workspaceSlug ?? '')
const { client: realtimeClient } = useRealtime(workspaceSlug)
// Teammates see that you're online and which issue you're on.
usePresence(workspaceSlug, realtimeClient)

const routeTitle = computed(
  () => [...route.matched].reverse().find((r) => r.meta.title)?.meta.title ?? '',
)
const crumbs = computed(() => ui.breadcrumb ?? [routeTitle.value])
// A page's breadcrumb only applies while it is shown.
watch(
  () => route.path,
  () => (ui.breadcrumb = null),
)

// `C` opens the create issue dialog, like Linear; ignored while typing.
onKeyStroke('c', (event) => {
  if (ui.createIssueOpen || !isPlainShortcut(event)) return
  event.preventDefault()
  ui.openCreateIssue()
})

// Load the dialog on first use, then keep it mounted so it can animate closed.
const createIssueLoaded = ref(false)
watch(
  () => ui.createIssueOpen,
  (open) => {
    if (open) createIssueLoaded.value = true
  },
)
</script>

<template>
  <!-- Inset shell (design.md → App shell): sidebar on the base, content on a raised panel. -->
  <div class="flex h-svh bg-app-base text-ink">
    <AppSidebar />
    <div
      class="my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-panel shadow-panel"
    >
      <PageHeader :crumbs="crumbs">
        <template #actions>
          <div :id="PANEL_HEADER_ACTIONS.slice(1)" class="flex items-center gap-2" />
        </template>
      </PageHeader>
      <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <RouterView />
      </main>
    </div>
    <CreateIssueDialog v-if="createIssueLoaded" />
  </div>
</template>
