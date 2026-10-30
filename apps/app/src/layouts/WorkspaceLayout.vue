<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { onKeyStroke } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'

const CreateIssueDialog = defineAsyncComponent(
  () => import('@/features/issues/components/CreateIssueDialog.vue'),
)

const route = useRoute()
const ui = useUiStore()

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
  const target = event.target
  if (event.metaKey || event.ctrlKey || event.altKey || ui.createIssueOpen) return
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select'))
  )
    return
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
      <header class="flex h-12 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-5">
        <h1 class="flex min-w-0 items-center gap-1.5 font-medium">
          <template v-for="(crumb, i) in crumbs" :key="i">
            <span v-if="i > 0" class="text-ink-tertiary" aria-hidden="true">›</span>
            <span class="truncate" :class="i < crumbs.length - 1 ? 'text-ink-muted' : 'text-ink'">
              {{ crumb }}
            </span>
          </template>
        </h1>
        <Button
          variant="ghost"
          size="sm"
          class="ml-auto"
          aria-keyshortcuts="C"
          @click="ui.openCreateIssue()"
        >
          <Plus class="size-4" aria-hidden="true" />
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
