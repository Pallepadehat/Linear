<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { isTypingTarget } from '@/lib/keyboard'
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
const crumbs = computed(() =>
  (ui.breadcrumb ?? [routeTitle.value]).map((crumb) =>
    typeof crumb === 'string' ? { label: crumb } : crumb,
  ),
)
// A page's breadcrumb only applies while it is shown.
watch(
  () => route.path,
  () => (ui.breadcrumb = null),
)

// `C` opens the create issue dialog, like Linear; ignored while typing.
onKeyStroke('c', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || ui.createIssueOpen) return
  if (isTypingTarget(event.target)) return
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
      <header class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-4">
        <h1 class="flex min-w-0 items-center gap-1.5 font-medium">
          <template v-for="(crumb, i) in crumbs" :key="i">
            <span v-if="i > 0" class="text-ink-tertiary" aria-hidden="true">›</span>
            <component
              :is="crumb.to ? RouterLink : 'span'"
              :to="crumb.to"
              class="flex min-w-0 items-center gap-1.5 rounded-md"
              :class="[
                i < crumbs.length - 1 ? 'shrink-0 text-ink-muted' : 'text-ink',
                crumb.to &&
                  '-mx-1 px-1 outline-hidden hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring',
              ]"
            >
              <span
                v-if="crumb.teamInitial"
                class="inline-flex size-4 shrink-0 items-center justify-center rounded-xs bg-surface-4 text-[9px] font-semibold text-ink-muted"
                aria-hidden="true"
                >{{ crumb.teamInitial }}</span
              >
              <span v-if="crumb.identifier" class="shrink-0 font-mono text-xs text-ink-subtle">
                {{ crumb.identifier }}
              </span>
              <span class="truncate">{{ crumb.label }}</span>
            </component>
          </template>
        </h1>
        <div :id="PANEL_HEADER_ACTIONS.slice(1)" class="ml-auto flex items-center gap-2" />
        <Button variant="ghost" size="sm" aria-keyshortcuts="C" @click="ui.openCreateIssue()">
          <Plus aria-hidden="true" />
          New issue
        </Button>
      </header>
      <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <RouterView />
      </main>
    </div>
    <CreateIssueDialog v-if="createIssueLoaded" />
  </div>
</template>
