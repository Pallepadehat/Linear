<script setup lang="ts">
import { Menu, Plus } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { unreadCountOptions } from '@/features/inbox/queries'
import { useUiStore, type Crumb } from '@/stores/ui'
import ProjectIcon from './ProjectIcon.vue'

/**
 * The 44px header on top of the content panel: on phones the sidebar menu button, then the
 * breadcrumb (or a custom `title` slot), an optional `favorite` slot (the star, M8-07), page
 * `actions`, then "New issue". On phones only the current crumb is shown.
 */
const props = defineProps<{ crumbs: Crumb[] }>()
const items = computed(() =>
  props.crumbs.map((crumb) => (typeof crumb === 'string' ? { label: crumb } : crumb)),
)

const ui = useUiStore()
const { slug } = useCurrentWorkspace()
// The drawer hides the Inbox badge on phones, so the menu button carries a dot instead.
const { data: unread } = useQuery(computed(() => unreadCountOptions(slug.value)))
const hasUnread = computed(() => (unread.value?.count ?? 0) > 0)
</script>

<template>
  <header
    class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-2 md:pl-4"
  >
    <Button
      variant="ghost"
      size="icon-sm"
      class="relative shrink-0 text-ink-muted md:hidden"
      :aria-label="hasUnread ? 'Open menu, unread notifications' : 'Open menu'"
      aria-haspopup="dialog"
      @click="ui.sidebarOpen = true"
    >
      <Menu aria-hidden="true" />
      <span
        v-if="hasUnread"
        class="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
        aria-hidden="true"
      />
    </Button>
    <h1 class="flex min-w-0 items-center gap-1.5 font-medium">
      <slot name="title">
        <template v-for="(crumb, i) in items" :key="i">
          <span
            v-if="i > 0"
            class="text-ink-tertiary max-md:hidden"
            aria-hidden="true"
            >›</span
          >
          <component
            :is="crumb.to ? RouterLink : 'span'"
            :to="crumb.to"
            class="flex min-w-0 items-center gap-1.5 rounded-md"
            :class="[
              i < items.length - 1 ? 'shrink-0 text-ink-muted max-md:hidden' : 'text-ink',
              crumb.to &&
                '-mx-1 px-1 outline-hidden hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring',
            ]"
          >
            <span
              v-if="crumb.teamInitial"
              class="inline-flex size-4 shrink-0 items-center justify-center rounded-xs bg-surface-4 text-[9px] font-semibold text-ink-muted"
              aria-hidden="true"
              >{{ crumb.teamInitial }}</span
            >
            <ProjectIcon v-if="crumb.projectIcon" :src="crumb.projectIcon.src" />
            <span v-if="crumb.identifier" class="shrink-0 font-mono text-xs text-ink-subtle">
              {{ crumb.identifier }}
            </span>
            <span class="truncate" :class="crumb.identifier && 'max-md:hidden'">{{
              crumb.label
            }}</span>
          </component>
        </template>
      </slot>
    </h1>
    <slot name="favorite" />
    <div class="ml-auto flex min-w-0 items-center gap-2">
      <slot name="actions" />
    </div>
    <Button
      variant="ghost"
      size="sm"
      class="shrink-0 max-md:size-7 max-md:px-0"
      aria-label="New issue"
      aria-keyshortcuts="C"
      @click="ui.openCreateIssue()"
    >
      <Plus aria-hidden="true" />
      <span class="max-md:hidden">New issue</span>
    </Button>
  </header>
</template>
