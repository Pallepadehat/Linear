<script setup lang="ts">
import { Bell, Plus } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useUiStore, type Crumb } from '@/stores/ui'
import IconButton from './IconButton.vue'

/**
 * The 44px header on top of the content panel: breadcrumb (or a custom `title` slot), an optional
 * `favorite` slot (the star, M8-07), page `actions`, then notifications and "New issue".
 */
const props = defineProps<{ crumbs: Crumb[] }>()
const items = computed(() =>
  props.crumbs.map((crumb) => (typeof crumb === 'string' ? { label: crumb } : crumb)),
)

const ui = useUiStore()
const { slug } = useCurrentWorkspace()
</script>

<template>
  <header class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-4">
    <h1 class="flex min-w-0 items-center gap-1.5 font-medium">
      <slot name="title">
        <template v-for="(crumb, i) in items" :key="i">
          <span v-if="i > 0" class="text-ink-tertiary" aria-hidden="true">›</span>
          <component
            :is="crumb.to ? RouterLink : 'span'"
            :to="crumb.to"
            class="flex min-w-0 items-center gap-1.5 rounded-md"
            :class="[
              i < items.length - 1 ? 'shrink-0 text-ink-muted' : 'text-ink',
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
            <span v-if="crumb.identifier" class="shrink-0 font-mono text-xs text-ink-subtle">
              {{ crumb.identifier }}
            </span>
            <span class="truncate">{{ crumb.label }}</span>
          </component>
        </template>
      </slot>
    </h1>
    <slot name="favorite" />
    <div class="ml-auto flex items-center gap-2">
      <slot name="actions" />
    </div>
    <IconButton
      :icon="Bell"
      label="Notifications"
      @click="$router.push({ name: 'inbox', params: { workspaceSlug: slug } })"
    />
    <Button variant="ghost" size="sm" aria-keyshortcuts="C" @click="ui.openCreateIssue()">
      <Plus aria-hidden="true" />
      New issue
    </Button>
  </header>
</template>
