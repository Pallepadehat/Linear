<script setup lang="ts">
import type { Favorite } from '@linear/contract'
import { ArrowDown, ArrowUp, Ellipsis, StarOff } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import ProjectIcon from '@/components/common/ProjectIcon.vue'
import SidebarItem from '@/components/common/SidebarItem.vue'
import SidebarSection from '@/components/common/SidebarSection.vue'
import StatusIcon from '@/components/common/StatusIcon.vue'
import TeamIcon from '@/components/common/TeamIcon.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { SIDEBAR_SECTIONS } from '@/layouts/sidebar-sections'
import { usePreferencesStore } from '@/stores/preferences'
import { isPending, moveFavorite } from '../favorite-list'
import { favoriteListOptions, useRemoveFavorite, useReorderFavorites } from '../queries'

// The personal "Favorites" sidebar section (M8-07); hidden while there are none.
const preferences = usePreferencesStore()
const { slug } = useCurrentWorkspace()
const { data: favorites } = useQuery(computed(() => favoriteListOptions(slug.value)))
const remove = useRemoveFavorite(slug)
const reorder = useReorderFavorites(slug)

function linkTo(favorite: Favorite): RouteLocationRaw {
  const params = { workspaceSlug: slug.value }
  switch (favorite.entityType) {
    case 'issue':
      return { name: 'issue', params: { ...params, identifier: favorite.identifier } }
    case 'project':
      return { name: 'project', params: { ...params, projectId: favorite.entityId } }
    case 'team':
      return { name: 'team-issues', params: { ...params, teamKey: favorite.key } }
  }
}
const labelOf = (favorite: Favorite) =>
  favorite.entityType === 'issue' ? favorite.title : favorite.name

function move(from: number, to: number) {
  const list = favorites.value ?? []
  // Optimistic rows have no server id yet, so the order can't be saved until they settle.
  if (list.some(isPending)) return
  const next = moveFavorite(list, from, to)
  if (next !== list) reorder.mutate(next)
}

// Drag to reorder: the row being dragged and the gap it would drop into (before row `index`).
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)
function onDragStart(event: DragEvent, index: number) {
  dragIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(event: DragEvent, index: number) {
  if (dragIndex.value === null) return
  event.preventDefault()
  const row = event.currentTarget as HTMLElement
  const { top, height } = row.getBoundingClientRect()
  dropIndex.value = event.clientY < top + height / 2 ? index : index + 1
}
function onDrop() {
  const from = dragIndex.value
  const gap = dropIndex.value
  endDrag()
  if (from === null || gap === null) return
  move(from, gap > from ? gap - 1 : gap)
}
function endDrag() {
  dragIndex.value = null
  dropIndex.value = null
}

// Right-click opens the row's "…" menu.
const menuFor = ref<string | null>(null)
</script>

<template>
  <SidebarSection
    v-if="favorites && favorites.length > 0"
    label="Favorites"
    :expanded="preferences.isExpanded(SIDEBAR_SECTIONS.favorites)"
    @toggle="preferences.setExpanded(SIDEBAR_SECTIONS.favorites)"
  >
    <div
      v-for="(favorite, index) in favorites"
      :key="favorite.id"
      class="group/favorite relative"
      :class="dragIndex === index && 'opacity-40'"
      draggable="true"
      @dragstart="onDragStart($event, index)"
      @dragover="onDragOver($event, index)"
      @drop.prevent="onDrop"
      @dragend="endDrag"
      @contextmenu.prevent="menuFor = favorite.id"
    >
      <span
        v-if="dropIndex === index || (dropIndex === index + 1 && index === favorites.length - 1)"
        class="pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-primary"
        :class="dropIndex === index ? '-top-px' : '-bottom-px'"
        aria-hidden="true"
      />
      <SidebarItem :to="linkTo(favorite)" :label="labelOf(favorite)" class="pr-7" draggable="false">
        <template #icon>
          <StatusIcon
            v-if="favorite.entityType === 'issue'"
            :category="favorite.statusCategory"
            class="size-4"
          />
          <ProjectIcon v-else-if="favorite.entityType === 'project'" :src="favorite.iconUrl" />
          <TeamIcon v-else :name="favorite.name" />
        </template>
      </SidebarItem>
      <DropdownMenu
        :open="menuFor === favorite.id"
        @update:open="(open) => (menuFor = open ? favorite.id : null)"
      >
        <DropdownMenuTrigger
          class="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full text-ink-subtle opacity-0 outline-hidden group-focus-within/favorite:opacity-100 group-hover/favorite:opacity-100 hover:bg-surface-4 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100"
          :aria-label="`${labelOf(favorite)} options`"
        >
          <Ellipsis class="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" class="w-52">
          <DropdownMenuItem :disabled="index === 0" @select="move(index, index - 1)">
            <ArrowUp class="size-4" aria-hidden="true" />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            :disabled="index === favorites.length - 1"
            @select="move(index, index + 1)"
          >
            <ArrowDown class="size-4" aria-hidden="true" />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="isPending(favorite)" @select="remove.mutate(favorite)">
            <StarOff class="size-4" aria-hidden="true" />
            Remove from favorites
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </SidebarSection>
</template>
