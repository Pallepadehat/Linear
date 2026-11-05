<script setup lang="ts">
import { CircleUser, SquarePen } from '@lucide/vue'
import { computed, nextTick, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useCurrentUser } from '@/features/auth/composables/useSession'
import { useUiStore } from '@/stores/ui'
import IssueList from '../components/IssueList.vue'

const TABS = [
  {
    key: 'assigned',
    label: 'Assigned',
    icon: CircleUser,
    title: 'No issues assigned to you',
    description: 'Issues assigned to you will show up here.',
  },
  {
    key: 'created',
    label: 'Created',
    icon: SquarePen,
    title: "You haven't created any issues",
    description: 'Issues you create will show up here.',
  },
] as const
type TabKey = (typeof TABS)[number]['key']

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const { data: me } = useCurrentUser()

// The tab lives in the URL (`?tab=created`) so reloads and links keep it; Assigned is the default.
const active = computed(() => TABS.find((t) => t.key === route.query.tab) ?? TABS[0])

function select(key: TabKey) {
  if (key === active.value.key) return
  void router.replace({ query: { ...route.query, tab: key === 'assigned' ? undefined : key } })
}

// Arrow keys move between tabs (WAI-ARIA tabs pattern, automatic activation).
const tabEls = useTemplateRef<HTMLButtonElement[]>('tabEls')
async function onTabKeydown(event: KeyboardEvent) {
  const index = TABS.findIndex((t) => t.key === active.value.key)
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % TABS.length
      : event.key === 'ArrowLeft'
        ? (index - 1 + TABS.length) % TABS.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? TABS.length - 1
            : null
  if (next === null) return
  event.preventDefault()
  select(TABS[next]!.key)
  await nextTick()
  tabEls.value?.[next]?.focus()
}

function createIssue() {
  // From Assigned, the new issue starts assigned to me so it lands in this list.
  ui.openCreateIssue(active.value.key === 'assigned' && me.value ? { assigneeId: me.value.id } : {})
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex h-11 shrink-0 items-center border-b border-hairline px-2 md:px-4">
      <div role="tablist" aria-label="My issues" class="flex items-center gap-1">
        <button
          v-for="tab in TABS"
          :id="`my-issues-tab-${tab.key}`"
          ref="tabEls"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="tab.key === active.key"
          aria-controls="my-issues-panel"
          :tabindex="tab.key === active.key ? 0 : -1"
          class="h-7 shrink-0 rounded-full border px-2.5 font-medium whitespace-nowrap outline-hidden md:px-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="
            tab.key === active.key
              ? 'border-hairline bg-surface-2 text-ink'
              : 'border-transparent text-ink-subtle hover:bg-surface-2 hover:text-ink'
          "
          @click="select(tab.key)"
          @keydown="onTabKeydown"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>
    <div
      id="my-issues-panel"
      role="tabpanel"
      :aria-labelledby="`my-issues-tab-${active.key}`"
      class="flex min-h-0 flex-1 flex-col"
    >
      <IssueList
        :key="active.key"
        :workspace-slug="slug"
        :assignee="active.key === 'assigned' ? 'me' : undefined"
        :creator="active.key === 'created' ? 'me' : undefined"
      >
        <template #empty>
          <EmptyState :icon="active.icon" :title="active.title" :description="active.description">
            <Button size="sm" @click="createIssue">Create issue</Button>
          </EmptyState>
        </template>
      </IssueList>
    </div>
  </div>
</template>
