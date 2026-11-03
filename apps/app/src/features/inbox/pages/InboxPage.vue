<script setup lang="ts">
import type { Notification, NotificationFilter } from '@linear/contract'
import { AlarmClock, Archive, CheckCheck, Ellipsis, Inbox } from '@lucide/vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, defineAsyncComponent, nextTick, ref, shallowRef, watch, watchEffect } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import IconButton from '@/components/common/IconButton.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useHotkeys } from '@/composables/useHotkeys'
import { isMacPlatform, shortcutKeys, type ShortcutId } from '@/lib/hotkeys'
import { useIssueNavStore } from '@/stores/issue-nav'
import { useUiStore } from '@/stores/ui'
import NotificationRow from '../components/NotificationRow.vue'
import { neighborAfterRemoval } from '../notification-cache'
import {
  notificationListOptions,
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useSnoozeNotification,
} from '../queries'
import { snoozePresets, type SnoozePreset } from '../snooze'

// The issue pane is the full issue page; loaded with the first selection.
const IssueDetailPage = defineAsyncComponent(
  () => import('@/features/issues/pages/IssueDetailPage.vue'),
)

const ROW_HEIGHT = 60
const PREFETCH_ROWS = 10

const { slug } = useCurrentWorkspace()
const ui = useUiStore()

const filter = ref<NotificationFilter>('all')
const query = useInfiniteQuery(computed(() => notificationListOptions(slug.value, filter.value)))
const items = computed(() => query.data.value?.pages.flatMap((p) => p.items) ?? [])

// The last opened notification stays shown even if a refetch drops it from the
// list (e.g. it was read while "Unread" is on); the list copy wins while present.
const opened = shallowRef<Notification | null>(null)
const selected = computed(() => items.value.find((n) => n.id === opened.value?.id) ?? opened.value)

const markRead = useMarkNotificationRead(slug)
const markUnread = useMarkNotificationUnread(slug)
const markAllRead = useMarkAllNotificationsRead(slug)
const archive = useArchiveNotification(slug)
const snooze = useSnoozeNotification(slug)

const scrollEl = ref<HTMLElement | null>(null)
const virtualizer = useVirtualizer(
  computed(() => ({
    count: items.value.length,
    getScrollElement: () => scrollEl.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })),
)
watchEffect(() => {
  const last = virtualizer.value.getVirtualItems().at(-1)
  if (!last || last.index < items.value.length - PREFETCH_ROWS) return
  if (query.hasNextPage.value && !query.isFetchingNextPage.value) void query.fetchNextPage()
})

/** Opening a notification shows its issue and marks it read. */
async function open(notification: Notification | null) {
  opened.value = notification
  if (!notification) return
  if (!notification.readAt) markRead.mutate(notification)
  const index = items.value.findIndex((n) => n.id === notification.id)
  if (index === -1) return
  virtualizer.value.scrollToIndex(index, { align: 'auto' })
  await nextTick()
  scrollEl.value?.querySelector<HTMLElement>(`[data-id="${notification.id}"] button`)?.focus()
}

function move(delta: 1 | -1) {
  const index = items.value.findIndex((n) => n.id === selected.value?.id)
  const next = index === -1 ? items.value[0] : items.value[index + delta]
  if (next) void open(next)
}

/** Archive or snooze: the row leaves and the selection moves to its neighbor. */
function removeSelected(remove: (n: Notification) => void) {
  const current = selected.value
  if (!current) return
  const next = neighborAfterRemoval(items.value, current.id)
  remove(current)
  void open(next)
}

function toggleRead() {
  const current = selected.value
  if (!current) return
  if (current.readAt) markUnread.mutate(current)
  else markRead.mutate(current)
}

const snoozeOpen = ref(false)
const presets = ref<SnoozePreset[]>([])
watch(snoozeOpen, (open) => {
  if (open) presets.value = snoozePresets()
})
function remindMe(preset: SnoozePreset) {
  removeSelected((notification) => snooze.mutate({ notification, until: preset.until }))
}

useHotkeys([
  { id: 'inbox-next', run: () => move(1) },
  { id: 'inbox-prev', run: () => move(-1) },
  {
    id: 'inbox-archive',
    run: () => (selected.value ? removeSelected((n) => archive.mutate(n)) : false),
  },
  { id: 'inbox-toggle-read', run: () => (selected.value ? toggleRead() : false) },
  {
    id: 'inbox-snooze',
    run: () => {
      if (!selected.value) return false
      snoozeOpen.value = true
    },
  },
])

// J/K belong to the Inbox here, not to a list the embedded issue was once opened from.
useIssueNavStore().clear()
// The embedded issue sets the panel breadcrumb; without one the header reads "Inbox".
watch(
  () => selected.value?.id,
  (id) => {
    if (id) return
    ui.breadcrumb = null
    ui.favoriteTarget = null
  },
)
// Switching between All and Unread starts from the top.
watch(filter, () => scrollEl.value?.scrollTo({ top: 0 }))

const keyHint = (id: ShortcutId) =>
  shortcutKeys(id)
    .flat()
    .join(isMacPlatform() ? '' : ' ')
const filterClass =
  'h-6 rounded-full px-2.5 text-xs text-ink-muted outline-hidden hover:text-ink focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-surface-3 aria-pressed:text-ink'
const itemClass = 'h-8 gap-2.5 rounded-md px-2.5 text-[13px] focus:bg-floating-hover'
</script>

<template>
  <div class="flex min-h-0 flex-1">
    <section
      aria-label="Notifications"
      class="flex w-full shrink-0 flex-col border-hairline md:w-[360px] md:border-r"
      :class="selected && 'hidden md:flex'"
    >
      <div class="flex h-11 shrink-0 items-center gap-1 border-b border-hairline pr-2 pl-3">
        <div role="group" aria-label="Show" class="flex items-center gap-0.5">
          <button
            type="button"
            :class="filterClass"
            :aria-pressed="filter === 'all'"
            @click="filter = 'all'"
          >
            All
          </button>
          <button
            type="button"
            :class="filterClass"
            :aria-pressed="filter === 'unread'"
            @click="filter = 'unread'"
          >
            Unread
          </button>
        </div>
        <span class="flex-1" aria-hidden="true" />
        <DropdownMenu v-model:open="snoozeOpen">
          <DropdownMenuTrigger as-child :disabled="!selected">
            <IconButton :icon="AlarmClock" label="Remind me" :shortcut="keyHint('inbox-snooze')" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            class="w-48 rounded-lg border-hairline bg-floating p-1.5"
          >
            <DropdownMenuItem
              v-for="preset in presets"
              :key="preset.id"
              :class="itemClass"
              @select="remindMe(preset)"
            >
              {{ preset.label }}
              <DropdownMenuShortcut class="tracking-normal text-ink-subtle">
                {{
                  preset.until.toLocaleString(undefined, {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                }}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          :icon="Archive"
          label="Archive"
          :shortcut="keyHint('inbox-archive')"
          :disabled="!selected"
          @click="removeSelected((n) => archive.mutate(n))"
        />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-ink-subtle data-[state=open]:bg-surface-2"
              aria-label="Inbox actions"
            >
              <Ellipsis aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            class="w-48 rounded-lg border-hairline bg-floating p-1.5"
          >
            <DropdownMenuItem :class="itemClass" @select="markAllRead.mutate()">
              <CheckCheck class="text-ink-subtle" aria-hidden="true" />
              Mark all as read
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        v-if="query.isPending.value"
        class="grid gap-1 p-2"
        aria-busy="true"
        aria-label="Loading notifications"
      >
        <div v-for="i in 6" :key="i" class="h-14 animate-pulse rounded-md bg-surface-2" />
      </div>
      <EmptyState
        v-else-if="query.isError.value"
        title="Couldn't load notifications"
        description="Check your connection and try again."
      >
        <Button variant="secondary" size="sm" @click="query.refetch()">Retry</Button>
      </EmptyState>
      <EmptyState
        v-else-if="items.length === 0"
        :icon="Inbox"
        title="No notifications"
        :description="
          filter === 'unread'
            ? 'You\'re all caught up.'
            : 'Updates on issues you follow will show up here.'
        "
      />
      <div v-else ref="scrollEl" class="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        <div
          role="list"
          class="relative w-full"
          :style="{ height: `${virtualizer.getTotalSize()}px` }"
        >
          <div
            v-for="item in virtualizer.getVirtualItems()"
            :key="items[item.index]!.id"
            role="listitem"
            :data-id="items[item.index]!.id"
            class="absolute top-0 left-0 flex w-full items-center"
            :style="{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }"
          >
            <NotificationRow
              :notification="items[item.index]!"
              :selected="items[item.index]!.id === selected?.id"
              @select="open(items[item.index]!)"
            />
          </div>
        </div>
      </div>
    </section>

    <div class="flex min-w-0 flex-1 flex-col" :class="!selected && 'hidden md:flex'">
      <IssueDetailPage
        v-if="selected"
        :key="selected.issue.identifier"
        :identifier="selected.issue.identifier"
        embedded
      />
      <EmptyState v-else-if="items.length > 0" title="No notification selected">
        <p class="text-xs text-ink-subtle">Use J and K to move through your Inbox.</p>
      </EmptyState>
    </div>
  </div>
</template>
