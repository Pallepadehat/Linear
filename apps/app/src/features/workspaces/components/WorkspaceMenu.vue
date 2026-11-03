<script setup lang="ts">
import { Check, ChevronDown, LogOut, Monitor, Moon, Plus, Settings, Sun, Users } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import WorkspaceIcon from '@/components/common/WorkspaceIcon.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useCurrentUser, useSignOut } from '@/features/auth/composables/useSession'
import { orpc } from '@/lib/orpc'

const router = useRouter()
const { workspace, slug } = useCurrentWorkspace()
const { data: workspaces } = useQuery(orpc.me.listWorkspaces.queryOptions())
const { data: user } = useCurrentUser()
const { mode } = useTheme()
const signOut = useSignOut()

const themes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

async function logOut() {
  await signOut()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <!-- Like Linear, the workspace menu also holds the account: settings, theme, log out. -->
  <DropdownMenu>
    <DropdownMenuTrigger
      class="flex h-7 min-w-0 items-center gap-2 rounded-md px-1.5 text-left outline-hidden hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-ring"
      :aria-label="`Workspace menu, ${workspace?.name ?? slug}`"
    >
      <WorkspaceIcon :name="workspace?.name ?? slug" />
      <span class="truncate font-medium text-ink">{{ workspace?.name ?? '…' }}</span>
      <ChevronDown class="size-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-60">
      <DropdownMenuItem
        @select="router.push({ name: 'settings', params: { workspaceSlug: slug } })"
      >
        <Settings class="size-4" aria-hidden="true" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuItem @select="router.push({ name: 'teams', params: { workspaceSlug: slug } })">
        <Users class="size-4" aria-hidden="true" />
        Teams
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <component
            :is="themes.find((t) => t.value === mode)?.icon"
            class="size-4 text-ink-subtle"
            aria-hidden="true"
          />
          Theme
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup v-model="mode">
            <DropdownMenuRadioItem v-for="t in themes" :key="t.value" :value="t.value">{{
              t.label
            }}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuLabel class="truncate text-xs font-normal text-ink-subtle">{{
        user?.email ?? 'Workspaces'
      }}</DropdownMenuLabel>
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
