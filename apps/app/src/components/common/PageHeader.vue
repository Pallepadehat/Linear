<script setup lang="ts">
import { Bell, Plus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useUiStore } from '@/stores/ui'
import IconButton from './IconButton.vue'

/**
 * The 44px header on top of the content panel: breadcrumb (or a custom `title` slot), an optional
 * `favorite` slot (the star, M8-07), page `actions`, then notifications and "New issue".
 */
defineProps<{ crumbs: string[] }>()

const ui = useUiStore()
const { slug } = useCurrentWorkspace()
</script>

<template>
  <header class="flex h-11 shrink-0 items-center gap-2 border-b border-hairline pr-2 pl-4">
    <h1 class="flex min-w-0 items-center gap-1.5 font-medium">
      <slot name="title">
        <template v-for="(crumb, i) in crumbs" :key="i">
          <span v-if="i > 0" class="text-ink-tertiary" aria-hidden="true">›</span>
          <span class="truncate" :class="i < crumbs.length - 1 ? 'text-ink-muted' : 'text-ink'">
            {{ crumb }}
          </span>
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
