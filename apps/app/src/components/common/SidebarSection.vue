<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { useId } from 'vue'

/** Collapsible sidebar group: a small heading button that toggles its rows. */
defineProps<{ label: string; expanded: boolean }>()
defineEmits<{ toggle: [] }>()

const contentId = useId()
</script>

<template>
  <section class="grid gap-px">
    <button
      type="button"
      class="group flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-subtle outline-hidden hover:bg-surface-3 hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-ring"
      :aria-expanded="expanded"
      :aria-controls="contentId"
      :aria-label="`${label} section`"
      @click="$emit('toggle')"
    >
      {{ label }}
      <ChevronRight
        class="size-3 shrink-0 transition-transform"
        :class="expanded && 'rotate-90'"
        aria-hidden="true"
      />
    </button>
    <div v-show="expanded" :id="contentId" class="grid gap-px">
      <slot />
    </div>
  </section>
</template>
