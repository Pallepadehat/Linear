<script setup lang="ts">
import { LogOut, Monitor, Moon, Settings, Sun } from '@lucide/vue'
import { useRouter } from 'vue-router'
import UserAvatar from '@/components/common/UserAvatar.vue'
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

const router = useRouter()
const { slug } = useCurrentWorkspace()
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
  <DropdownMenu>
    <DropdownMenuTrigger
      class="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
      :aria-label="`${user?.name ?? ''} account menu`.trim()"
    >
      <UserAvatar :name="user?.name ?? ''" :src="user?.avatarUrl" />
      <span class="truncate text-ink-muted">{{ user?.name }}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="start" class="w-56">
      <DropdownMenuLabel class="truncate text-xs font-normal text-ink-subtle">{{
        user?.email
      }}</DropdownMenuLabel>
      <DropdownMenuItem
        @select="router.push({ name: 'settings', params: { workspaceSlug: slug } })"
      >
        <Settings class="size-4" aria-hidden="true" />
        Settings
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
      <DropdownMenuItem @select="logOut">
        <LogOut class="size-4" aria-hidden="true" />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
