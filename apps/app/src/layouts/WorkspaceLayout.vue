<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import AppSidebar from './AppSidebar.vue'

const CreateIssueDialog = defineAsyncComponent(
  () => import('@/features/issues/components/CreateIssueDialog.vue'),
)

const route = useRoute()
const title = computed(
  () => [...route.matched].reverse().find((r) => r.meta.title)?.meta.title ?? '',
)

const ui = useUiStore()

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
  <div class="flex h-svh bg-canvas text-ink">
    <AppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-11 shrink-0 items-center border-b border-hairline px-4">
        <h1 class="truncate font-medium text-ink">{{ title }}</h1>
      </header>
      <main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <RouterView />
      </main>
    </div>
    <CreateIssueDialog v-if="createIssueLoaded" />
  </div>
</template>
