<script setup lang="ts">
import type { GithubAvailableRepository } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Check, Search, X } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'

const { slug } = useCurrentWorkspace()
const queryClient = useQueryClient()
const { data, isPending } = useQuery(
  computed(() =>
    orpc.github.repositories.list.queryOptions({ input: { workspaceSlug: slug.value } }),
  ),
)

// Repositories: the server returns every repository the App can see per account, so
// search, filtering and paging happen here. Connected ones sort first.
const PAGE_SIZE = 20
const query = ref('')
const show = ref<'all' | 'connected'>('all')
/** Rows shown per installation; grows with "Show more", resets when the search changes. */
const shown = reactive<Record<string, number>>({})
watch([query, show], () => {
  for (const id of Object.keys(shown)) delete shown[id]
})

const totalRepos = computed(
  () => data.value?.installations.reduce((n, i) => n + i.repositories.length, 0) ?? 0,
)
const installations = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return (data.value?.installations ?? []).map((installation) => {
    const matches = installation.repositories
      .filter((r) => !needle || r.fullName.toLowerCase().includes(needle))
      .filter((r) => show.value === 'all' || r.repositoryId)
      .sort(
        (a, b) =>
          Number(Boolean(b.repositoryId)) - Number(Boolean(a.repositoryId)) ||
          a.fullName.localeCompare(b.fullName),
      )
    const limit = shown[installation.id] ?? PAGE_SIZE
    return {
      installation,
      connected: installation.repositories.filter((r) => r.repositoryId).length,
      matches: matches.length,
      visible: matches.slice(0, limit),
      remaining: Math.max(0, matches.length - limit),
    }
  })
})
function showMore(installationId: string) {
  shown[installationId] = (shown[installationId] ?? PAGE_SIZE) + PAGE_SIZE
}
const showOptions = [
  { value: 'all', label: 'All' },
  { value: 'connected', label: 'Connected' },
] as const

const install = useMutation(orpc.github.installUrl.mutationOptions())
async function startInstall() {
  try {
    const { url } = await install.mutateAsync({ workspaceSlug: slug.value })
    // GitHub sends the owner back to /setup/github when the install is done.
    window.location.assign(url)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}

const connect = useMutation(orpc.github.repositories.connect.mutationOptions())
const disconnect = useMutation(orpc.github.repositories.disconnect.mutationOptions())
const busyRepoId = ref<number | null>(null)

async function toggle(installationId: string, repo: GithubAvailableRepository) {
  busyRepoId.value = repo.githubRepoId
  try {
    if (repo.repositoryId) {
      await disconnect.mutateAsync({ workspaceSlug: slug.value, id: repo.repositoryId })
      toast.success(`Disconnected ${repo.fullName}`)
    } else {
      await connect.mutateAsync({
        workspaceSlug: slug.value,
        installationId,
        githubRepoId: repo.githubRepoId,
      })
      toast.success(`Connected ${repo.fullName}`)
    }
    await queryClient.invalidateQueries({ queryKey: orpc.github.repositories.list.key() })
  } catch (error) {
    toast.error(errorMessage(error))
  } finally {
    busyRepoId.value = null
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-hairline bg-surface-1 px-4 py-3"
    >
      <div class="min-w-0">
        <p class="text-ink">GitHub App</p>
        <p class="text-xs text-ink-subtle">
          Pull requests that mention an issue identifier are linked to the issue.
        </p>
      </div>
      <Button
        size="sm"
        :disabled="!data?.configured || install.isPending.value"
        @click="startInstall"
      >
        {{ data?.installations.length ? 'Add GitHub account' : 'Install GitHub App' }}
      </Button>
    </div>

    <p v-if="data && !data.configured" class="text-xs text-ink-subtle">
      The GitHub App isn't configured on this server. Set the
      <code class="font-mono">GITHUB_APP_*</code>
      variables to enable it.
    </p>
    <p v-if="isPending" class="px-1 text-ink-subtle">Loading…</p>

    <!-- Search and filter once there's more than a screenful. -->
    <div v-if="totalRepos > 8" class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <Input
          v-model="query"
          type="search"
          placeholder="Search repositories..."
          aria-label="Search repositories"
          class="h-8 pr-8 pl-8"
          @keydown.esc="query = ''"
        />
        <button
          v-if="query"
          type="button"
          class="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear search"
          @click="query = ''"
        >
          <X class="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <div role="group" aria-label="Show" class="flex items-center gap-0.5">
        <button
          v-for="option in showOptions"
          :key="option.value"
          type="button"
          class="h-7 rounded-full px-3 text-xs text-ink-muted outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-surface-3 aria-pressed:text-ink"
          :aria-pressed="show === option.value"
          @click="show = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <section
      v-for="group in installations"
      :key="group.installation.id"
      :aria-label="`Repositories for ${group.installation.accountLogin}`"
      class="overflow-hidden rounded-lg border border-hairline bg-surface-1"
    >
      <h3
        class="flex items-center gap-2 border-b border-hairline px-4 py-2.5 text-xs font-medium text-ink-subtle"
      >
        <span class="truncate text-ink-muted">{{ group.installation.accountLogin }}</span>
        <span class="ml-auto shrink-0 font-normal tabular-nums">
          {{ group.connected }} of {{ group.installation.repositories.length }} connected
        </span>
      </h3>
      <ul class="divide-y divide-hairline">
        <li v-if="group.installation.repositories.length === 0" class="px-4 py-3 text-ink-subtle">
          No repositories. Give the App access to repositories on GitHub.
        </li>
        <li v-else-if="group.matches === 0" class="px-4 py-3 text-ink-subtle">
          {{
            query ? `No repositories match “${query.trim()}”.` : 'No connected repositories yet.'
          }}
        </li>
        <li
          v-for="repo in group.visible"
          :key="repo.githubRepoId"
          class="flex h-10 items-center gap-3 px-4"
        >
          <span class="min-w-0 flex-1 truncate text-ink" :title="repo.fullName">
            <span class="text-ink-subtle">{{ repo.fullName.split('/')[0] }}/</span
            >{{ repo.fullName.split('/').slice(1).join('/') }}
          </span>
          <span
            v-if="repo.repositoryId"
            class="inline-flex items-center gap-1 text-xs text-ink-subtle"
          >
            <Check class="size-3.5" aria-hidden="true" /><span class="max-sm:sr-only"
              >Connected</span
            >
          </span>
          <Button
            size="sm"
            :variant="repo.repositoryId ? 'ghost' : 'secondary'"
            :disabled="busyRepoId !== null"
            :aria-label="`${repo.repositoryId ? 'Disconnect' : 'Connect'} ${repo.fullName}`"
            @click="toggle(group.installation.id, repo)"
          >
            {{ repo.repositoryId ? 'Disconnect' : 'Connect' }}
          </Button>
        </li>
      </ul>
      <div
        v-if="group.remaining > 0"
        class="flex items-center gap-2 border-t border-hairline px-4 py-1.5"
      >
        <span class="text-xs text-ink-subtle tabular-nums">
          Showing {{ group.visible.length }} of {{ group.matches }}
        </span>
        <Button variant="ghost" size="sm" class="ml-auto" @click="showMore(group.installation.id)">
          Show {{ Math.min(PAGE_SIZE, group.remaining) }} more
        </Button>
      </div>
    </section>
  </div>
</template>
