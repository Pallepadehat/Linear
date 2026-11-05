<script setup lang="ts">
import type { Notification, NotificationFilter } from '@linear/contract'
import { Bell, CheckCheck } from '@lucide/vue'
import { useInfiniteQuery, useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import IconButton from '@/components/common/IconButton.vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useIsMobile } from '@/composables/useIsMobile'
import { shortcutKeys } from '@/lib/hotkeys'
import { useUiStore } from '@/stores/ui'
import {
  notificationListOptions,
  unreadCountOptions,
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useSnoozeNotification,
} from '../queries'
import type { SnoozePreset } from '../snooze'
import NotificationRow from './NotificationRow.vue'

/**
 * The sidebar's Notifications button and its popover: a compact, newest-first list where a
 * click opens the issue (and marks it read). Replaces the old two-pane Inbox page.
 */
const ui = useUiStore()
const router = useRouter()
const isMobile = useIsMobile()
const { slug } = useCurrentWorkspace()

const { data: unread } = useQuery(computed(() => unreadCountOptions(slug.value)))
const unreadCount = computed(() => unread.value?.count ?? 0)

const filter = ref<NotificationFilter>('all')
const query = useInfiniteQuery(
  computed(() => ({
    ...notificationListOptions(slug.value, filter.value),
    // Only fetched while the popover is open; the badge uses the unread count.
    enabled: ui.notificationsOpen,
  })),
)
const items = computed(() => query.data.value?.pages.flatMap((p) => p.items) ?? [])

const markRead = useMarkNotificationRead(slug)
const markUnread = useMarkNotificationUnread(slug)
const markAllRead = useMarkAllNotificationsRead(slug)
const archive = useArchiveNotification(slug)
const snooze = useSnoozeNotification(slug)

function open(notification: Notification) {
  if (!notification.readAt) markRead.mutate(notification)
  ui.notificationsOpen = false
  ui.sidebarOpen = false
  void router.push({
    name: 'issue',
    params: { workspaceSlug: slug.value, identifier: notification.issue.identifier },
  })
}
function toggleRead(notification: Notification) {
  if (notification.readAt) markUnread.mutate(notification)
  else markRead.mutate(notification)
}
function remind(notification: Notification, preset: SnoozePreset) {
  snooze.mutate({ notification, until: preset.until })
}

const filters: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
]
const goKeys = shortcutKeys('go-inbox').flat().join(' ')
</script>

<template>
  <Popover v-model:open="ui.notificationsOpen">
    <PopoverTrigger
      class="flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-ink-muted outline-hidden hover:bg-surface-3 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-surface-3 data-[state=open]:text-ink"
      :aria-label="unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'"
      :aria-keyshortcuts="goKeys"
    >
      <Bell class="size-4 shrink-0" aria-hidden="true" />
      <span class="truncate">Notifications</span>
      <span
        v-if="unreadCount"
        class="ml-auto rounded-xs bg-primary px-1 text-xs font-medium text-primary-foreground tabular-nums"
        aria-hidden="true"
        >{{ unreadCount > 99 ? '99+' : unreadCount }}</span
      >
    </PopoverTrigger>
    <PopoverContent
      :side="isMobile ? 'top' : 'right'"
      align="end"
      :side-offset="8"
      :collision-padding="8"
      class="flex max-h-[min(560px,80svh)] w-[380px] max-w-[calc(100vw-16px)] flex-col gap-0 overflow-hidden rounded-lg border-hairline bg-floating p-0 shadow-floating"
    >
      <header class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-3">
        <h2 class="text-[13px] font-medium text-ink">Notifications</h2>
        <div role="group" aria-label="Show" class="flex items-center gap-0.5">
          <button
            v-for="f in filters"
            :key="f.value"
            type="button"
            class="h-6 rounded-full px-2.5 text-xs text-ink-muted outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-surface-3 aria-pressed:text-ink"
            :aria-pressed="filter === f.value"
            @click="filter = f.value"
          >
            {{ f.label }}
          </button>
        </div>
        <IconButton
          :icon="CheckCheck"
          label="Mark all as read"
          class="ml-auto"
          :disabled="!unreadCount"
          @click="markAllRead.mutate()"
        />
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
        <div v-if="query.isPending.value" class="grid gap-1 p-1" aria-busy="true">
          <div v-for="i in 4" :key="i" class="h-11 animate-pulse rounded-md bg-surface-2" />
        </div>
        <div
          v-else-if="!items.length"
          class="flex flex-col items-center gap-1 px-4 py-10 text-center"
        >
          <Bell class="mb-1 size-5 text-ink-tertiary" aria-hidden="true" />
          <p class="text-[13px] font-medium text-ink">
            {{ filter === 'unread' ? 'No unread notifications' : "You're all caught up" }}
          </p>
          <p class="text-xs text-ink-subtle">
            Assignments, mentions and comments on issues you follow show up here.
          </p>
        </div>
        <ul v-else class="grid gap-px" aria-label="Notifications">
          <li v-for="n in items" :key="n.id">
            <NotificationRow
              :notification="n"
              @open="open(n)"
              @archive="archive.mutate(n)"
              @toggle-read="toggleRead(n)"
              @remind="remind(n, $event)"
            />
          </li>
        </ul>
        <div v-if="query.hasNextPage.value" class="flex justify-center p-1">
          <Button
            variant="ghost"
            size="sm"
            :disabled="query.isFetchingNextPage.value"
            @click="query.fetchNextPage()"
          >
            {{ query.isFetchingNextPage.value ? 'Loading…' : 'Load older' }}
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
