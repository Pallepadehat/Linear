<script setup lang="ts">
import { Star } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentWorkspace } from '@/composables/useCurrentWorkspace'
import { useUiStore } from '@/stores/ui'
import { useToggleFavorite } from '../queries'

// The star next to the breadcrumb for whatever entity the page put in `ui.favoriteTarget`.
const ui = useUiStore()
const { slug } = useCurrentWorkspace()
const { isFavorite, toggle } = useToggleFavorite(slug)

const active = computed(() => Boolean(ui.favoriteTarget && isFavorite(ui.favoriteTarget)))
const label = computed(() => (active.value ? 'Remove from favorites' : 'Add to favorites'))
</script>

<template>
  <Tooltip v-if="ui.favoriteTarget">
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-ink-subtle"
        :aria-label="label"
        aria-keyshortcuts="Alt+F"
        @click="ui.favoriteTarget && toggle(ui.favoriteTarget)"
      >
        <Star :class="active && 'fill-current text-status-started'" aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent class="flex items-center gap-2">
      {{ label }}
      <kbd class="font-sans text-ink-subtle">⌥F</kbd>
    </TooltipContent>
  </Tooltip>
</template>
