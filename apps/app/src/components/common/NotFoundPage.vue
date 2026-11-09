<script setup lang="ts">
import { FileQuestion } from '@lucide/vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
</script>

<template>
  <main class="flex min-h-svh flex-col bg-canvas">
    <EmptyState
      :icon="FileQuestion"
      title="Page not found"
      title-as="h1"
      description="The page you're looking for doesn't exist."
    >
      <Button variant="secondary" as-child>
        <RouterLink to="/">Go home</RouterLink>
      </Button>
    </EmptyState>
  </main>
</template>
