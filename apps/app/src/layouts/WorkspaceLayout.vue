<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import FavoriteButton from '@/features/favorites/components/FavoriteButton.vue'
import { useToggleFavorite } from '@/features/favorites/queries'
import { useRealtime } from '@/features/realtime/useRealtime'
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'
import { PANEL_HEADER_ACTIONS } from './panel-header'

const CreateIssueDialog = defineAsyncComponent(
  () => import('@/features/issues/components/CreateIssueDialog.vue'),
)

const route = useRoute()
const ui = useUiStore()

// Teammates' changes show up live while the workspace is open.
useRealtime(() => String(route.params.workspaceSlug ?? ''))

const routeTitle = computed(
  () => [...route.matched].reverse().find((r) => r.meta.title)?.meta.title ?? '',
)
const crumbs = computed(() => ui.breadcrumb ?? [routeTitle.value])
// A page's breadcrumb only applies while it is shown.
watch(
  () => route.path,
  () => {
    ui.breadcrumb = null
    ui.favoriteTarget = null
  },
)

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || Boolean(target.closest('input, textarea, select')))

// `C` opens the create issue dialog, like Linear; ignored while typing.
onKeyStroke('c', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || ui.createIssueOpen) return
  if (isTyping(event.target)) return
  event.preventDefault()
  ui.openCreateIssue()
})

// ⌥F toggles the favorite on the page's entity. Matched by code: on macOS ⌥F types "ƒ".
const favorites = useToggleFavorite(() => String(route.params.workspaceSlug ?? ''))
onKeyStroke((event) => {
  if (event.code !== 'KeyF' || !event.altKey || event.metaKey || event.ctrlKey) return
  if (!ui.favoriteTarget || ui.createIssueOpen || isTyping(event.target)) return
  event.preventDefault()
  favorites.toggle(ui.favoriteTarget)
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
        <template #favorite>
          <FavoriteButton />
        </template>
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
