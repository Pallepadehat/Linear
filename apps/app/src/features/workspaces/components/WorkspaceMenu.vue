<script setup lang="ts">
import { Check, ChevronDown, LogOut, Plus } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import WorkspaceIcon from '@/components/common/WorkspaceIcon.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useSignOut } from '@/features/auth/composables/useSession'
import { orpc } from '@/lib/orpc'

const router = useRouter()
const { workspace, slug } = useCurrentWorkspace()
const { data: workspaces } = useQuery(orpc.me.listWorkspaces.queryOptions())
const signOut = useSignOut()

async function logOut() {
  await signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      class="flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      <WorkspaceIcon :name="workspace?.name ?? slug" />
      <span class="truncate font-medium text-ink">{{ workspace?.name ?? '…' }}</span>
      <ChevronDown class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-60">
      <DropdownMenuLabel class="text-xs font-normal text-ink-subtle">Workspaces</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="w in workspaces"
        :key="w.id"
        @select="router.push({ name: 'my-issues', params: { workspaceSlug: w.slug } })"
      >
        <WorkspaceIcon :name="w.name" />
        <span class="truncate">{{ w.name }}</span>
        <Check v-if="w.slug === slug" class="ml-auto size-4 text-ink-subtle" aria-label="Current" />
      </DropdownMenuItem>
      <DropdownMenuItem @select="router.push({ name: 'workspace-setup' })">
        <Plus class="size-4" aria-hidden="true" />
        Create workspace
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="logOut">
        <LogOut class="size-4" aria-hidden="true" />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
