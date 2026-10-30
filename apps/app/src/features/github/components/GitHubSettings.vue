<script setup lang="ts">
import type { GithubAvailableRepository } from '@linear/contract'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { Check } from '@lucide/vue'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
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
      class="flex items-center justify-between gap-4 rounded-lg border border-hairline bg-surface-1 px-4 py-3"
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
        {{ data?.installations.length ? 'Add GitHub account' : 'Install' }}
      </Button>
    </div>

    <p v-if="data && !data.configured" class="text-xs text-ink-subtle">
      The GitHub App isn't configured on this server. Set the
      <code class="font-mono">GITHUB_APP_*</code>
      variables to enable it.
    </p>
    <p v-if="isPending" class="px-1 text-ink-subtle">Loading…</p>

    <section
      v-for="installation in data?.installations"
      :key="installation.id"
      :aria-label="`Repositories for ${installation.accountLogin}`"
      class="rounded-lg border border-hairline bg-surface-1"
    >
      <h3 class="border-b border-hairline px-4 py-2.5 text-xs font-medium text-ink-subtle">
        {{ installation.accountLogin }}
      </h3>
      <ul class="divide-y divide-hairline">
        <li v-if="installation.repositories.length === 0" class="px-4 py-3 text-ink-subtle">
          No repositories. Give the App access to repositories on GitHub.
        </li>
        <li
          v-for="repo in installation.repositories"
          :key="repo.githubRepoId"
          class="flex h-10 items-center gap-3 px-4"
        >
          <span class="min-w-0 flex-1 truncate text-ink">{{ repo.fullName }}</span>
          <span
            v-if="repo.repositoryId"
            class="inline-flex items-center gap-1 text-xs text-ink-subtle"
          >
            <Check class="size-3.5" aria-hidden="true" />Connected
          </span>
          <Button
            size="sm"
            :variant="repo.repositoryId ? 'ghost' : 'secondary'"
            :disabled="busyRepoId !== null"
            :aria-label="`${repo.repositoryId ? 'Disconnect' : 'Connect'} ${repo.fullName}`"
            @click="toggle(installation.id, repo)"
          >
            {{ repo.repositoryId ? 'Disconnect' : 'Connect' }}
          </Button>
        </li>
      </ul>
    </section>
  </div>
</template>
