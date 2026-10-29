<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'

const route = useRoute()
const title = computed(
  () => [...route.matched].reverse().find((r) => r.meta.title)?.meta.title ?? '',
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
  </div>
</template>
