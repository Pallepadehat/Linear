<script setup lang="ts">
import type { Notification } from '@linear/contract'
import { AlarmClock, Archive, Ellipsis, Mail, MailOpen } from '@lucide/vue'
import { ref } from 'vue'
import IconButton from '@/components/common/IconButton.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import GitHubIcon from '@/features/github/components/GitHubIcon.vue'
import { fullDate, shortTimeAgo } from '@/lib/relative-time'
import { snoozePresets, type SnoozePreset } from '../snooze'

/**
 * One compact notification in the popover: the whole row opens the issue; Archive and a
 * "…" menu (read state, Remind me) show on hover, focus and always on touch screens.
 */
const props = defineProps<{ notification: Notification }>()
const emit = defineEmits<{
  open: []
  archive: []
  toggleRead: []
  remind: [preset: SnoozePreset]
}>()

const menuOpen = ref(false)
const presets = ref<SnoozePreset[]>([])
function onMenu(open: boolean) {
  menuOpen.value = open
  if (open) presets.value = snoozePresets()
}
const remindTime = (date: Date) =>
  date.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
const actor = () =>
  props.notification.actor.type === 'github'
    ? 'GitHub'
    : (props.notification.actor.name ?? 'Someone')
</script>

<template>
  <div
    class="group relative flex min-w-0 items-start gap-2.5 rounded-md px-2 py-2 hover:bg-floating-hover has-[[data-state=open]]:bg-floating-hover"
  >
    <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center">
      <GitHubIcon v-if="notification.actor.type === 'github'" class="size-4 text-ink-muted" />
      <UserAvatar v-else :name="actor()" :src="notification.actor.avatarUrl" size="sm" />
    </span>
    <!-- The row's main action; stretched over the row so the whole row is clickable. -->
    <button
      type="button"
      class="grid min-w-0 flex-1 gap-0.5 text-left outline-hidden after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
      :aria-label="`${notification.readAt ? '' : 'Unread: '}${notification.issue.identifier} ${notification.issue.title}, ${notification.summary}`"
      @click="emit('open')"
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <StatusIcon :category="notification.issue.status.category" class="size-3 shrink-0" />
        <span class="shrink-0 font-mono text-xs text-ink-subtle">
          {{ notification.issue.identifier }}
        </span>
        <span
          class="truncate"
          :class="notification.readAt ? 'text-ink-muted' : 'font-medium text-ink'"
        >
          {{ notification.issue.title }}
        </span>
      </span>
      <span class="truncate text-xs text-ink-subtle">
        <span class="text-ink-muted">{{ actor() }}</span> {{ notification.summary }}
      </span>
    </button>
    <span class="flex shrink-0 items-center gap-1.5 self-center">
      <time
        :datetime="notification.createdAt.toISOString()"
        :title="fullDate(notification.createdAt)"
        class="text-xs text-ink-subtle tabular-nums group-focus-within:hidden group-hover:hidden pointer-coarse:hidden"
        :class="menuOpen && 'hidden'"
      >
        {{ shortTimeAgo(notification.createdAt) }}
      </time>
      <!-- Above the stretched button so they stay clickable. -->
      <span
        class="relative z-10 hidden items-center group-focus-within:flex group-hover:flex pointer-coarse:flex"
        :class="menuOpen && 'flex!'"
      >
        <IconButton :icon="Archive" label="Archive" class="size-6" @click="emit('archive')" />
        <DropdownMenu :open="menuOpen" @update:open="onMenu">
          <DropdownMenuTrigger as-child>
            <IconButton :icon="Ellipsis" label="More actions" class="size-6" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem @select="emit('toggleRead')">
              <component :is="notification.readAt ? Mail : MailOpen" aria-hidden="true" />
              {{ notification.readAt ? 'Mark as unread' : 'Mark as read' }}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <AlarmClock aria-hidden="true" />
                Remind me
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="w-56">
                <DropdownMenuItem
                  v-for="preset in presets"
                  :key="preset.id"
                  @select="emit('remind', preset)"
                >
                  {{ preset.label }}
                  <DropdownMenuShortcut>{{ remindTime(preset.until) }}</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="emit('archive')">
              <Archive aria-hidden="true" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      <span
        class="size-2 shrink-0 rounded-full"
        :class="notification.readAt ? 'bg-transparent' : 'bg-primary'"
        aria-hidden="true"
      />
    </span>
  </div>
</template>
