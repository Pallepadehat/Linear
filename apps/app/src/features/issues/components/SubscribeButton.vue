<script setup lang="ts">
import { BellOff, BellPlus } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'
import IconButton from '@/components/common/IconButton.vue'

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
  <!-- Distinct from the header's notifications bell: the icon names the action. -->
  <IconButton
    :icon="subscribed ? BellOff : BellPlus"
    :label="label"
    shortcut="⇧S"
    :aria-pressed="subscribed"
    @click="emit('toggle')"
  />
</template>
