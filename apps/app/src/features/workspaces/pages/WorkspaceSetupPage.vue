<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import CreateWorkspaceForm from '../components/CreateWorkspaceForm.vue'
import JoinWorkspaceForm from '../components/JoinWorkspaceForm.vue'

const { data: workspaces } = useQuery(orpc.me.listWorkspaces.queryOptions())

// Kept in the URL (`?mode=join`) so an owner can send testers straight to the join form.
const route = useRoute()
const router = useRouter()
type Mode = 'create' | 'join'
const mode = computed<Mode>({
  get: () => (route.query.mode === 'join' ? 'join' : 'create'),
  set: (value) =>
    void router.replace({ query: { ...route.query, mode: value === 'join' ? 'join' : undefined } }),
})

const options: { value: Mode; label: string }[] = [
  { value: 'create', label: 'Create' },
  { value: 'join', label: 'Join' },
]
const copy = computed(() =>
  mode.value === 'join'
    ? { title: 'Join a workspace', subtitle: 'Enter the invite code you were given.' }
    : { title: 'Create a workspace', subtitle: 'Workspaces hold your teams, projects and issues.' },
)
</script>

<template>
  <div class="grid gap-6">
    <div
      role="radiogroup"
      aria-label="Create or join a workspace"
      class="grid grid-cols-2 gap-1 justify-self-center rounded-full border border-hairline bg-surface-1 p-1"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="mode === option.value"
        :class="
          cn(
            'h-7 rounded-full px-4 text-ink-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            mode === option.value && 'bg-surface-3 text-ink',
          )
        "
        @click="mode = option.value"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="space-y-1 text-center">
      <h1 class="text-xl font-semibold tracking-tight text-ink">{{ copy.title }}</h1>
      <p class="text-ink-subtle">{{ copy.subtitle }}</p>
    </div>
    <JoinWorkspaceForm v-if="mode === 'join'" />
    <CreateWorkspaceForm v-else />
    <p v-if="workspaces?.length" class="text-center text-ink-subtle">
      <RouterLink to="/" class="font-medium text-link hover:underline"
        >Back to your workspace</RouterLink
      >
    </p>
  </div>
</template>
