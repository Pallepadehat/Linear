<script setup lang="ts">
import { Bell, BellOff } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// The issue page's bell: subscribes the signed-in user, or unsubscribes them.
// ⇧S toggles it from anywhere outside a text field.
const props = defineProps<{ subscribed: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const label = computed(() => (props.subscribed ? 'Unsubscribe' : 'Subscribe'))

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
  if (!event.shiftKey || event.key.toUpperCase() !== 'S') return
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select'))
  )
    return
  if (document.querySelector('[role="dialog"][data-state="open"]')) return
  event.preventDefault()
  emit('toggle')
})
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="label"
        :aria-pressed="subscribed"
        aria-keyshortcuts="Shift+S"
        :class="subscribed ? 'text-ink' : 'text-ink-subtle'"
        @click="emit('toggle')"
      >
        <BellOff v-if="subscribed" aria-hidden="true" />
        <Bell v-else aria-hidden="true" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" class="flex items-center gap-2">
      {{ label }}
      <kbd class="font-sans text-xs opacity-70">⇧S</kbd>
    </TooltipContent>
  </Tooltip>
</template>
